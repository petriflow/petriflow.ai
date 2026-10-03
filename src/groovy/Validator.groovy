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
 * Reads newline-delimited JSON requests on stdin, each of the form:
 *   {"source": "<normalized action code>"}
 *
 * For each request it wraps the code in a @CompileStatic class extending the
 * stripped ActionDelegate and compiles it (compile-only, never executed).
 * It writes one JSON response per request to stdout:
 *   {"ok": true}  or  {"ok": false, "issues": [{rule, severity, line, column, message}]}
 *
 * The action code is expected to already have Petriflow field references
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

    def source = request.source
    if (source == null) {
        return [ok: false, issues: [[rule: "request", severity: "error", message: "Missing 'source' field"]]]
    }

    def wrapped = wrap(source)

    def cu = new CompilationUnit(classLoader)
    cu.addSource("ActionDelegate.groovy", delegateSource)
    cu.addSource("ActionScript.groovy", wrapped)

    try {
        cu.compile(Phases.CLASS_GENERATION)
        return [ok: true]
    } catch (MultipleCompilationErrorsException e) {
        def issues = e.errorCollector.errors.collect { err -> toIssue(err) }
        return [ok: false, issues: issues]
    } catch (Exception e) {
        return [ok: false, issues: [[rule: "compile", severity: "error", message: "Unexpected error: ${e.message}"]]]
    }
}

// Number of lines prepended to the action source by wrap().
@Field int LINE_OFFSET = 5

def wrap(String source) {
    return """import groovy.transform.CompileStatic

@CompileStatic(extensions = ["DynamicTypeCheckingExtension"])
class ActionScript extends ActionDelegate {
    void run() {
${source}
    }
}
"""
}

def toIssue(Object err) {
    if (err instanceof SyntaxErrorMessage) {
        def cause = err.cause
        if (cause instanceof SyntaxException) {
            def line = cause.line - LINE_OFFSET
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
