import org.codehaus.groovy.control.*
import org.codehaus.groovy.ast.*

// ---------------------------------------------------------------------------
// Generates a stripped, standalone ActionDelegate from the NAE source.
//
// The stripped version keeps the full DSL method surface (signatures only) so
// that action code can be statically compiled against it, without any Spring
// or NAE runtime dependencies. The original NAE source is NOT part of this
// project: it is downloaded from the pinned NAE ref, or read from a local NAE
// checkout.
//
// Usage:
//   groovy src/groovy/tools/generate-delegate.groovy [options] [path]
//
//   --source <file>      Local NAE ActionDelegate.groovy (wins over --ref/--path).
//                        A bare positional path is accepted too.
//   --ref <git-ref>      NAE ref to download (default: NAE_REF below).
//   --path <repo-path>   ActionDelegate path inside that ref (default: NAE_PATH).
//   --out <file>         Output path (default: src/groovy/lib/ActionDelegate.groovy).
//   --check              Do not write; fail when the output is out of date.
//
// When bumping NAE, change NAE_REF and NAE_PATH together, regenerate, and
// commit both this script's constants and the generated file.
// ---------------------------------------------------------------------------

def NAE_REPO = "netgrif/application-engine"
def NAE_REF = "v7.0.3"
def NAE_PATH = "application-engine/src/main/groovy/com/netgrif/application/engine/petrinet/domain/dataset/logic/action/ActionDelegate.groovy"
def DEFAULT_OUT = "src/groovy/lib/ActionDelegate.groovy"
def CONNECT_TIMEOUT_MS = 10_000
def READ_TIMEOUT_MS = 60_000

def fail = { String message ->
    System.err.println message
    System.exit 1
}

def parseArgs = { String[] argv ->
    def options = [source: null, ref: NAE_REF, path: NAE_PATH, out: DEFAULT_OUT, check: false]
    def positional = []

    for (int i = 0; i < argv.length; i++) {
        def arg = argv[i]
        if (arg == "--source" || arg == "--ref" || arg == "--path" || arg == "--out") {
            if (i + 1 >= argv.length) fail("Missing value for ${arg}")
            options[arg.substring(2)] = argv[++i]
        } else if (arg == "--check") {
            options.check = true
        } else if (arg == "--help" || arg == "-h") {
            println "Usage: groovy src/groovy/tools/generate-delegate.groovy [--source <file>] [--ref <git-ref>] [--path <repo-path>] [--out <file>] [--check]"
            System.exit 0
        } else if (arg.startsWith("--")) {
            fail("Unknown option ${arg}")
        } else {
            positional << arg
        }
    }

    if (positional.size() > 1) fail("Unexpected extra arguments: ${positional[1..-1].join(' ')}")
    if (!options.source && positional) options.source = positional[0]
    options
}

def options = parseArgs(args)

def sha256 = { String text ->
    def digest = java.security.MessageDigest.getInstance("SHA-256")
    digest.digest(text.getBytes("UTF-8")).collect { String.format("%02x", it) }.join()
}

// --- Resolve the original NAE source ---------------------------------------
def sourceText
def sourceLabel
if (options.source) {
    def sourceFile = new File(options.source)
    if (!sourceFile.isFile()) fail("ActionDelegate source not found: ${sourceFile.path}")
    sourceText = sourceFile.text
    sourceLabel = "local file ${sourceFile.name}"
} else {
    def url = "https://raw.githubusercontent.com/${NAE_REPO}/${options.ref}/${options.path}"
    try {
        def connection = (java.net.HttpURLConnection) new URL(url).openConnection()
        connection.connectTimeout = CONNECT_TIMEOUT_MS
        connection.readTimeout = READ_TIMEOUT_MS
        connection.setRequestProperty("User-Agent", "petriflow.ai-generate-delegate")
        if (connection.responseCode != 200) {
            fail("Failed to download ${url} (HTTP ${connection.responseCode})")
        }
        sourceText = connection.inputStream.getText("UTF-8")
    } catch (java.io.IOException e) {
        fail("Failed to download ${url}: ${e.message}")
    }
    sourceLabel = "${NAE_REPO}@${options.ref}"
}

if (!sourceText?.trim()) fail("ActionDelegate source is empty (${sourceLabel})")
if (!sourceText.contains("class ActionDelegate")) {
    fail("Source does not declare a class ActionDelegate (${sourceLabel})")
}
def sourceSha = sha256(sourceText)

// --- Parse the original at CONVERSION --------------------------------------
// Bodies and imports are never resolved, so NAE itself is not needed here.
def cu = new CompilationUnit()
cu.addSource("ActionDelegate.groovy", sourceText)
cu.compile(Phases.CONVERSION)
def ad = cu.ast.modules[0].classes.find { it.name.tokenize(".").last() == "ActionDelegate" }
if (ad == null) fail("ActionDelegate class not found in the parsed source")

// --- Types that are available on the JVM/Groovy classpath (no stub needed) --
def KNOWN = [
    "void", "int", "long", "boolean", "double", "float", "byte", "char", "short",
    "String", "Object", "Integer", "Long", "Boolean", "Double", "Float", "Byte",
    "Character", "Short", "Number", "BigDecimal", "BigInteger", "Class",
    "Map", "List", "Set", "Collection", "Optional", "Locale", "Date", "Calendar",
    "TimeZone", "UUID", "Iterable", "Stream", "Comparator",
    "File", "InputStream", "OutputStream", "Reader", "Writer",
    "ZoneId", "LocalDate", "LocalDateTime", "Instant", "ZonedDateTime", "LocalTime",
    "Closure", "MetaClass", "GString",
] as Set

// --- DSL chain methods that need typed return types ------------------------
def DSL_RETURNS = [
    "change": "ChangeResult",
    "changeCaseProperty": "CasePropertyResult",
    "make": "MakeResult",
    "execute": "ExecuteResult",
    "generate": "GenerateResult",
] as Map

// --- Closure-valued fields (properties holding closures) -------------------
def CLOSURE_FIELDS = [
    "visible", "editable", "required", "optional", "hidden", "forbidden", "initial",
    "unchanged", "transitions", "initValueOfField", "close", "always", "once",
    "byCode", "byCity", "byIco",
] as Set

// --- Delegate state referenced by action code ------------------------------
// Spring-injected NAE services are deliberately not part of the stripped class.
def CONTEXT_FIELDS = [
    "useCase", "task", "params", "action", "actionsRunner",
    "outcomes", "Frontend", "NaeModule", "Plugin", "map",
]

// --- Emitted result classes, never stubbed ---------------------------------
def RESULT_TYPES = [
    "ChangeResult", "CasePropertyResult", "MakeResult", "MakeOnResult",
    "ExecuteResult", "GenerateResult",
] as Set

def normalizeType = { String type ->
    type = type.replace("java.lang.", "")
    // Single-letter names are generic type parameters (e.g. <T>); map to Object
    if (type ==~ /[A-Z]/) {
        type = "Object"
    }
    type
}

// --- Collect every referenced type, including generic arguments ------------
def collectTypes
collectTypes = { ClassNode type, Set<String> acc ->
    if (type == null) return
    if (type.isArray()) {
        collectTypes(type.componentType, acc)
        return
    }
    if (type.name) acc << type.name
    type.genericsTypes?.each { generic ->
        if (generic?.type != null) collectTypes(generic.type, acc)
    }
}

def typeText
typeText = { ClassNode type ->
    if (type.isArray()) return "${typeText(type.componentType)}[]"
    def base = normalizeType(type.name)
    def generics = type.genericsTypes
    if (generics == null || generics.length == 0) return base
    def arguments = generics.collect { generic -> generic?.type != null ? typeText(generic.type) : "?" }
    "${base}<${arguments.join(', ')}>"
}

// --- Collect method signatures and context field types ---------------------
def referencedTypes = new TreeSet<String>()
def methods = []

ad.methods.each { method ->
    def params = method.parameters.collect { parameter ->
        [name: parameter.name, type: parameter.type.name, hasDefault: parameter.hasInitialExpression()]
    }
    methods << [name: method.name, returnType: method.returnType.name, params: params]

    collectTypes(method.returnType, referencedTypes)
    method.parameters.each { parameter -> collectTypes(parameter.type, referencedTypes) }
}

def contextFields = CONTEXT_FIELDS.collect { fieldName ->
    def field = ad.fields.find { it.name == fieldName }
    if (field == null) fail("Context field ${fieldName} not found in ActionDelegate; review CONTEXT_FIELDS")
    collectTypes(field.type, referencedTypes)
    field
}

// Determine which types need stubs
def isIdentifier = { String name -> name ==~ /[A-Za-z_$][A-Za-z0-9_$]*/ }
def stubTypes = referencedTypes.findAll { name ->
    def base = normalizeType(name.replaceAll(/<.*>/, "").replaceAll(/\[\]/, ""))
    isIdentifier(base) && !KNOWN.contains(base) && !base.startsWith("java.") &&
        !RESULT_TYPES.contains(base) && base != "ActionDelegate"
}.collect { normalizeType(it) }.unique().sort()

// ---------------------------------------------------------------------------
// Emit the stripped delegate
// ---------------------------------------------------------------------------
def sb = new StringBuilder()
sb << "// AUTO-GENERATED — do not edit by hand.\n"
sb << "// Source: ${sourceLabel}\n"
if (!options.source) {
    sb << "// Path: ${options.path}\n"
}
sb << "// SHA-256: ${sourceSha}\n"
sb << "// Regenerate (pinned NAE ref): groovy src/groovy/tools/generate-delegate.groovy\n"
sb << "// Regenerate (local NAE checkout): groovy src/groovy/tools/generate-delegate.groovy --source /path/to/ActionDelegate.groovy\n"
sb << "// Stripped ActionDelegate: full DSL method surface, no Spring/NAE runtime deps.\n\n"
sb << "import groovy.transform.CompileStatic\n\n"

// Stub types
sb << "// --- Stub types (stand-ins for NAE domain classes) ---\n"
sb << "class Stub {\n"
sb << "    Stub value\n"
sb << "    String stringId\n"
sb << "    String importId\n"
sb << "    def getAt(int i) { null }\n"
sb << "    def getAt(String k) { null }\n"
sb << "}\n"

// Field subtypes extend Field so they inherit its common properties.
def FIELD_SUBTYPES = [
    "ChoiceField", "CaseField", "MapOptionsField", "FileField", "MultichoiceMapField",
    "DataField", "TextField", "NumberField", "UserListField", "MultichoiceField",
    "EnumerationField", "EnumerationMapField", "I18nField", "FileListField",
    "TaskField", "UserField", "BooleanField", "DateField", "DateTimeField", "TimeField",
] as Set

// Special stub types with commonly-accessed properties.
def SPECIAL_STUBS = [
    "Field": "class Field extends Stub {\n    Object type\n    Map options\n    Object choices\n    Object defaultValue\n    Map behavior\n    Object validations\n}",
    "Case": "class Case extends Stub {\n    String title\n    String color\n    PetriNet petriNet\n    Map dataSet\n    List tasks\n}",
    "Task": "class Task extends Stub {\n    String caseId\n    String transitionId\n    Map dataSet\n}",
    "Transition": "class Transition extends Stub {\n    Map dataSet\n}",
    "PetriNet": "class PetriNet extends Stub {\n    Map transitions\n    Map dataSet\n}",
    "AbstractUser": "class AbstractUser extends Stub {\n    String fullName\n    String email\n}",
    "I18nString": "class I18nString extends Stub {\n}",
]

stubTypes.each { type ->
    if (SPECIAL_STUBS.containsKey(type)) {
        sb << SPECIAL_STUBS[type] << "\n"
    } else if (FIELD_SUBTYPES.contains(type)) {
        sb << "class ${type} extends Field {}\n"
    } else {
        sb << "class ${type} extends Stub {}\n"
    }
}
sb << "\n"

// DSL chain result types
sb << "// --- Typed DSL chain results ---\n"
sb << "class ChangeResult {\n"
sb << "    def value(Closure c) { null }\n"
sb << "    def about(Closure c) { null }\n"
sb << "    def choices(Closure c) { null }\n"
sb << "    def allowedNets(Closure c) { null }\n"
sb << "    def options(Closure c) { null }\n"
sb << "    def validations(Closure c) { null }\n"
sb << "    def componentProperties(Closure c) { null }\n"
sb << "}\n"
sb << "class CasePropertyResult {\n"
sb << "    def about(Closure c) { null }\n"
sb << "}\n"
sb << "class MakeResult {\n"
sb << "    MakeOnResult on(Object o) { null }\n"
sb << "}\n"
sb << "class MakeOnResult {\n"
sb << "    void when(Closure c) {}\n"
sb << "}\n"
sb << "class ExecuteResult {\n"
sb << "    void with(Map m) {}\n"
sb << "    ExecuteResult where(Closure c) { null }\n"
sb << "}\n"
sb << "class GenerateResult {\n"
sb << "    def into(Field field) { null }\n"
sb << "}\n\n"

// The delegate class
sb << "class ActionDelegate {\n\n"

// Static constants
sb << "    static final String UNCHANGED_VALUE = \"unchangedooo\"\n"
sb << "    static final String ALWAYS_GENERATE = \"always\"\n"
sb << "    static final String ONCE_GENERATE = \"once\"\n"
sb << "    static final String TRANSITIONS = \"transitions\"\n"
sb << "    static final String GLOBAL_ROLE = \"GLOBAL_ROLE\"\n\n"

// Closure fields
CLOSURE_FIELDS.each { field ->
    sb << "    Closure ${field} = null\n"
}

// Context fields, typed from the parsed source
contextFields.each { field ->
    sb << "    ${typeText(field.type)} ${field.name} = null\n"
}
sb << "\n"

// Methods
methods.each { method ->
    def returnType = method.returnType == "void" ? "void" : (DSL_RETURNS[method.name] ?: "def")
    def params = method.params.collect { parameter ->
        def type = normalizeType(parameter.type)
        def defaultValue = parameter.hasDefault ? " = null" : ""
        "${type} ${parameter.name}${defaultValue}"
    }.join(", ")
    def body = method.returnType == "void" ? "{}" : "{ null }"
    sb << "    ${returnType} ${method.name}(${params}) ${body}\n"
}

// Loose `Object` overloads for the DSL chain methods that take a field/transition
// as their primary argument. Process `<function>` bodies use dynamically-typed
// (`def`) parameters, so calls like `change(fieldParam)` must resolve even when
// `fieldParam` is typed `Object`.
sb << "\n    // Loose overloads for dynamically-typed function bodies.\n"
sb << "    ChangeResult change(Object field, Case targetCase = null, Optional targetTask = null) { null }\n"
sb << "    MakeResult make(Object fieldOrList, Closure behavior) { null }\n"
sb << "}\n"

def generated = sb.toString()
def outFile = new File(options.out)

if (options.check) {
    if (!outFile.isFile()) fail("Generated file not found: ${outFile.path}")
    if (outFile.text == generated) {
        println "Up to date: ${outFile.path}"
        return
    }

    def expected = generated.readLines()
    def actual = outFile.text.readLines()
    def limit = Math.max(expected.size(), actual.size())
    def index = (0..<limit).find { i -> i >= expected.size() || i >= actual.size() || expected[i] != actual[i] }
    System.err.println "Generated ActionDelegate is out of date: ${outFile.path}"
    System.err.println "First difference at line ${index + 1}:"
    System.err.println "  expected: ${index < expected.size() ? expected[index] : '<missing>'}"
    System.err.println "  actual:   ${index < actual.size() ? actual[index] : '<missing>'}"
    System.exit 1
}

outFile.parentFile.mkdirs()
outFile.text = generated
println "Generated ${outFile} (${methods.size()} methods, ${stubTypes.size()} stub types) from ${sourceLabel}"
