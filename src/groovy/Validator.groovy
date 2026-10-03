import groovy.json.JsonSlurper
import groovy.json.JsonOutput
import groovy.transform.Field
import org.codehaus.groovy.control.CompilationUnit
import org.codehaus.groovy.control.Phases
import org.codehaus.groovy.control.MultipleCompilationErrorsException
import org.codehaus.groovy.control.messages.SyntaxErrorMessage
import org.codehaus.groovy.control.messages.Message
import org.codehaus.groovy.syntax.SyntaxException

/**
 * Groovy action validator daemon.
 *
 * Reads newline-delimited JSON requests on stdin and writes one JSON response
 * per request to stdout. Two request shapes are accepted:
 *
 *   1. Validate an action (optionally with injected process functions):
 *        {"source": "<normalized action code>",
 *         "functions": [{"name": "who", "body": "{ def u -> ... }"}, ...]}
 *
 *   2. Validate a standalone function body (a Groovy closure):
 *        {"function": "{ def u -> ... }"}
 *
 * Each response is either:
 *   {"ok": true}
 * or
 *   {"ok": false, "issues": [{rule, severity, line, column, message}]}
 *
 * The action `source` is expected to already have Petriflow field references
 * (e.g. "c_active: f.c_active;") normalized to typed declarations
 * (e.g. "Field c_active = null") by the Node side.
 */

// Resolve the lib directory (stripped ActionDelegate + type-checking extension)
// relative to this script's own location.
def scriptFile = new File(getClass().protectionDomain.codeSource.location.toURI().path)
def libDir = new File(scriptFile.parentFile, "lib")
if (!libDir.exists()) {
    // Fallback: relative to the current working directory (dev mode).
    libDir = new File("src/groovy/lib")
}
def delegateSource = new File(libDir, "ActionDelegate.groovy").text
def extensionSource = new File(libDir, "DynamicTypeCheckingExtension.groovy").text

// Compile the type-checking extension so it is available to the @CompileStatic
// annotation when the action code is compiled.
def classLoader = new GroovyClassLoader(this.class.classLoader)
classLoader.parseClass(extensionSource)

def slurper = new JsonSlurper()
def reader = new BufferedReader(new InputStreamReader(System.in))
def writer = new BufferedWriter(new OutputStreamWriter(System.out))

String line
while ((line = reader.readLine()) != null) {
    if (line.trim().isEmpty()) {
        continue
    }
    def result = validate(line, slurper, delegateSource, classLoader)
    writer.write(JsonOutput.toJson(result))
    writer.newLine()
    writer.flush()
}

def validate(String line, JsonSlurper slurper, String delegateSource, GroovyClassLoader classLoader) {
    def request
    try {
        request = slurper.parseText(line)
    } catch (Exception e) {
        return [ok: false, issues: [[rule: "request", severity: "error", message: "Invalid request JSON: ${e.message}"]]]
    }

    // Mode 1: validate a standalone function body (a Groovy closure).
    if (request.function != null) {
        return compile(functionWrap(request.function), delegateSource, classLoader, FUNCTION_LINE_OFFSET)
    }

    // Mode 2 (and default): validate an action, optionally with injected functions.
    def source = request.source
    if (source == null) {
        return [ok: false, issues: [[rule: "request", severity: "error", message: "Missing 'source' or 'function' field"]]]
    }
    def functions = request.functions ?: []
    return compile(wrap(source, functions), delegateSource, classLoader, actionLineOffset(functions))
}

// Number of lines in the action wrapper preamble *before* the injected functions.
@Field int ACTION_BASE_LINE_OFFSET = 5

// Number of lines prepended to a standalone function body by functionWrap().
@Field int FUNCTION_LINE_OFFSET = 5

// The action wrapper emits one line per injected function plus one blank line,
// so the total preamble length depends on the number of functions.
int actionLineOffset(List functions) {
    return ACTION_BASE_LINE_OFFSET + functions.size() + 1
}

def compile(String wrapped, String delegateSource, GroovyClassLoader classLoader, int lineOffset) {
    def cu = new CompilationUnit(classLoader)
    cu.addSource("ActionDelegate.groovy", delegateSource)
    cu.addSource("ActionScript.groovy", wrapped)

    try {
        cu.compile(Phases.CLASS_GENERATION)
        return [ok: true]
    } catch (MultipleCompilationErrorsException e) {
        def issues = e.errorCollector.errors.collect { err -> toIssue(err, lineOffset) }
        return [ok: false, issues: issues]
    } catch (Exception e) {
        return [ok: false, issues: [[rule: "compile", severity: "error", message: "Unexpected error: ${e.message}"]]]
    }
}

def wrap(String source, List functions) {
    def sb = new StringBuilder()
    sb << "import groovy.transform.CompileStatic\n\n"
    sb << "@CompileStatic(extensions = [\"DynamicTypeCheckingExtension\"])\n"
    sb << "class ActionScript extends ActionDelegate {\n"
    // Inject process functions as methods so they resolve under static
    // compilation. Function bodies are Groovy closures ("{ def a, def b -> ... }"),
    // so we rewrite the closure header into a method signature.
    functions.each { fn ->
        sb << methodFromClosure(fn.name, fn.body)
    }
    sb << "\n    void run() {\n"
    sb << source
    sb << "\n    }\n"
    sb << "}\n"
    return sb.toString()
}

// Rewrites a closure body of the form "{ def a, def b -> BODY }" (params may
// span multiple lines) into an equivalent method "def name(def a, def b) { BODY }".
def methodFromClosure(String name, String body) {
    def trimmed = body.trim()
    if (!trimmed.startsWith("{")) {
        // Not a closure with an obvious header; fall back to a no-arg def method
        // wrapping the raw body (best effort — will likely fail to compile).
        return "    def ${name}() { ${body} }\n"
    }
    // Strip the outer braces.
    def inner = trimmed.substring(1, trimmed.length() - 1).trim()
    def arrow = inner.indexOf("->")
    if (arrow < 0) {
        // No params: "{ BODY }".
        return "    def ${name}() { ${inner} }\n"
    }
    def params = inner.substring(0, arrow).trim()
    def methodBody = inner.substring(arrow + 2).trim()
    if (params.isEmpty()) {
        return "    def ${name}() { ${methodBody} }\n"
    }
    // The closure params are typically "def a, def b" — use them directly as a
    // method parameter list (with `def` they are dynamically typed).
    return "    def ${name}(${params}) { ${methodBody} }\n"
}

// Wraps a standalone function body (a closure) so it can be compiled in isolation.
// Uses the same closure-to-method transformation as injected functions, and adds
// a dummy run() so the class surfaces the method via static checking.
def functionWrap(String body) {
    def method = methodFromClosure("\$fn", body)
    return """import groovy.transform.CompileStatic

@CompileStatic(extensions = ["DynamicTypeCheckingExtension"])
class ActionScript extends ActionDelegate {
${method}
    void run() { }
}
"""
}

def toIssue(Object err, int lineOffset) {
    if (err instanceof SyntaxErrorMessage) {
        def cause = err.cause
        if (cause instanceof SyntaxException) {
            def line = cause.line - lineOffset
            def message = cause.message?.replaceAll(/\s*@ line \d+, column \d+\.?\s*$/, "")?.trim()
            return [
                rule: "compile",
                severity: "error",
                line: line > 0 ? line : 1,
                column: cause.startColumn,
                message: message
            ]
        }
        return [rule: "compile", severity: "error", message: cause?.message ?: err.toString()]
    }
    if (err instanceof Message) {
        return [rule: "compile", severity: "error", message: err.toString()]
    }
    return [rule: "compile", severity: "error", message: err.toString()]
}
