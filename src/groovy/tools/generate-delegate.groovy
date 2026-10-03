import org.codehaus.groovy.control.*
import org.codehaus.groovy.ast.*

// ---------------------------------------------------------------------------
// Generates a stripped, standalone ActionDelegate from the original NAE source.
// The stripped version keeps the full DSL method surface (signatures only) so
// that action code can be statically compiled against it, without any Spring
// or NAE runtime dependencies.
//
// Usage:
//   groovy src/groovy/tools/generate-delegate.groovy <path-to-ActionDelegate.groovy> [output-path]
//
// The original NAE ActionDelegate.groovy is NOT part of this project; it is
// provided as the first argument.
// ---------------------------------------------------------------------------

if (args.length < 1) {
    System.err.println "Usage: groovy src/groovy/tools/generate-delegate.groovy <path-to-ActionDelegate.groovy> [output-path]"
    System.exit 1
}

def srcFile = new File(args[0])
def outFile = new File(args.length > 1 ? args[1] : "src/groovy/lib/ActionDelegate.groovy")

def src = srcFile.text
def cu = new CompilationUnit()
cu.addSource("ActionDelegate.groovy", src)
cu.compile(Phases.CONVERSION)
def ad = cu.ast.modules[0].classes[0]

// --- Types that are available on the JVM/Groovy classpath (no stub needed) ---
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

// --- DSL chain methods that need typed return types ---
def DSL_RETURNS = [
    "change": "ChangeResult",
    "changeCaseProperty": "CasePropertyResult",
    "make": "MakeResult",
    "execute": "ExecuteResult",
    "generate": "GenerateResult",
] as Map

// --- Closure-valued fields (properties holding closures) ---
def CLOSURE_FIELDS = [
    "visible", "editable", "required", "optional", "hidden", "forbidden", "initial",
    "unchanged", "transitions", "initValueOfField", "close", "always", "once",
    "byCode", "byCity", "byIco",
] as Set

// --- Collect all referenced types and method signatures ---
def types = new TreeSet<String>()
def methods = []

ad.methods.each { m ->
    def params = m.parameters.collect { p ->
        [name: p.name, type: p.type.name, hasDefault: p.hasInitialExpression()]
    }
    methods << [name: m.name, returnType: m.returnType.name, params: params]
    if (m.returnType.name != "void" && m.returnType.name != "java.lang.Object") {
        types << m.returnType.name
    }
    params.each { p -> types << p.type }
}

// Normalize type names (strip java.lang. prefix, handle generics)
def normalizeType = { String t ->
    t = t.replace("java.lang.", "")
    // Single-letter names are generic type parameters (e.g. <T>); map to Object
    if (t ==~ /[A-Z]/) {
        t = "Object"
    }
    t
}

// Determine which types need stubs
def stubTypes = types.findAll { t ->
    def base = t.replaceAll(/<.*>/, "").replaceAll(/\[\]/, "")
    !KNOWN.contains(base) && !KNOWN.contains(normalizeType(base))
}.collect { normalizeType(it) }.sort()

// Additional types referenced only by delegate fields (not method signatures).
stubTypes = (stubTypes + ["EventOutcome", "FrontendActionOutcome", "ModuleHolder", "PluginHolder"]).unique().sort()

// ---------------------------------------------------------------------------
// Emit the stripped delegate
// ---------------------------------------------------------------------------
def sb = new StringBuilder()
sb << "// AUTO-GENERATED from ${srcFile.name} by src/groovy/tools/generate-delegate.groovy\n"
sb << "// Do not edit by hand. Regenerate with: groovy src/groovy/tools/generate-delegate.groovy <path-to-ActionDelegate.groovy>\n"
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

stubTypes.each { t ->
    if (SPECIAL_STUBS.containsKey(t)) {
        sb << SPECIAL_STUBS[t] << "\n"
    } else if (FIELD_SUBTYPES.contains(t)) {
        sb << "class ${t} extends Field {}\n"
    } else {
        sb << "class ${t} extends Stub {}\n"
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
CLOSURE_FIELDS.each { f ->
    sb << "    Closure ${f} = null\n"
}

// Context fields (delegate state referenced by action code)
sb << "    Case useCase = null\n"
sb << "    Optional<Task> task = null\n"
sb << "    Map<String, String> params = null\n"
sb << "    Action action = null\n"
sb << "    FieldActionsRunner actionsRunner = null\n"
sb << "    List<EventOutcome> outcomes = null\n"
sb << "    FrontendActionOutcome Frontend = null\n"
sb << "    ModuleHolder NaeModule = null\n"
sb << "    PluginHolder Plugin = null\n"
sb << "    Map map = null\n"
sb << "\n"

// Methods
methods.each { m ->
    def ret = m.returnType == "void" ? "void" : (DSL_RETURNS[m.name] ?: "def")
    def params = m.params.collect { p ->
        def t = normalizeType(p.type)
        def d = p.hasDefault ? " = null" : ""
        "${t} ${p.name}${d}"
    }.join(", ")
    def body = m.returnType == "void" ? "{}" : "{ null }"
    sb << "    ${ret} ${m.name}(${params}) ${body}\n"
}

sb << "}\n"

outFile.parentFile.mkdirs()
outFile.text = sb.toString()
println "Generated ${outFile} (${methods.size()} methods, ${stubTypes.size()} stub types)"
