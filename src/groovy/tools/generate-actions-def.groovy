import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import org.codehaus.groovy.control.*

// ---------------------------------------------------------------------------
// Generates src/public/fallback/actions-def.json from the original NAE
// ActionDelegate.groovy source.
//
// Documents every user-facing DSL action callable from a Petriflow action,
// in three shapes (matching the hand-written entries):
//
//   chained method  -> { description[, deprecated], dslChain: { item: {...} } }
//   overloaded      -> { description[, deprecated], alts: [ {...}, ... ] }
//   single          -> { signature, description[, deprecated], params, examples }
//
// Each leaf carries: signature, description, params[{name,type,required,description}],
// and examples[]. Descriptions come from Javadoc when present; otherwise a curated
// or synthesized description is used. @Deprecated methods get "deprecated": true.
//
// Usage:
//   groovy src/groovy/tools/generate-actions-def.groovy [output-path]
// ---------------------------------------------------------------------------

if (args.length > 1) {
    System.err.println "Usage: groovy src/groovy/tools/generate-actions-def.groovy [output-path]"
    System.exit 1
}

def srcFile = new File("src/groovy/original/ActionDelegate.groovy")
def outFile = new File(args.length ? args[0] : "src/public/fallback/actions-def.json")

if (!srcFile.exists()) {
    System.err.println "Original ActionDelegate not found: ${srcFile.path}"
    System.exit 1
}

def src = srcFile.text
def srcLines = src.readLines()

def cu = new CompilationUnit()
cu.addSource("ActionDelegate.groovy", src)
cu.compile(Phases.CONVERSION)
def ad = cu.ast.modules[0].classes[0]

// ---------------------------------------------------------------------------
// Curated descriptions for the most important DSL actions (no Javadoc in NAE).
// ---------------------------------------------------------------------------
def DESCRIPTIONS = [
    change: "Change attributes of a data field (value, choices, options, validations, allowedNets or component properties).",
    execute: "Execute a transition in all cases matching a query, optionally setting data on the executed tasks.",
    make: "Change behavior (visibility, editability, requirement, etc.) of fields on transitions/tasks when a condition is met.",
    generate: "Generate a file/text and store the result into a target field using the specified method.",
    findCases: "Find cases matching a query predicate.",
    findCase: "Find a single case by query predicate or string id.",
    findTasks: "Find tasks matching a query predicate.",
    findTask: "Find a single task by query predicate or id.",
    createCase: "Create a new case of the given process identifier.",
    deleteCase: "Delete a case.",
    assignTask: "Assign a task to a user.",
    assignTasks: "Assign multiple tasks to a user.",
    cancelTask: "Cancel a task.",
    cancelTasks: "Cancel multiple tasks.",
    finishTask: "Finish a task.",
    finishTasks: "Finish multiple tasks.",
    setData: "Set data field values on a given task.",
    getData: "Get the data fields of a given task.",
    assignRole: "Assign a role to a user.",
    removeRole: "Remove a role from a user.",
    changeCaseProperty: "Change a property of the current case (title, color, ...).",
    changeUser: "Change an attribute of a user identified by id or AbstractUser.",
    changeUserByEmail: "Change an attribute of a user identified by email.",
    inviteUser: "Invite a new user.",
    deleteUser: "Delete a user.",
    findUserByEmail: "Find a user by email.",
    findUserById: "Find a user by id.",
    cache: "Store a value in, or read a value from, the action cache.",
    cacheFree: "Remove a value from the action cache.",
    sendEmail: "Send an email to the given recipients.",
    sendMail: "Send a prepared mail draft.",
    generatePdf: "Generate a PDF from a source transition and store it into a target file field.",
    generatePDF: "Generate a PDF from a source transition and store it into a target file field.",
    loggedUser: "Return the currently logged-in user.",
    setDataWithPropagation: "Deprecated. Set data field values with propagation on the given task.",
    nullable: "Wrap a value into a Nullable container.",
    dynamicValidation: "Create a dynamic validation instance.",
    validation: "Create a static validation instance.",
    i18n: "Create an I18nString with translations.",
]

// ---------------------------------------------------------------------------
// Chain roots. A chain method returns a fluent DSL map; the value maps to the
// chain items (map keys) users can call.
// ---------------------------------------------------------------------------
def CHAIN_ITEMS = [
    change: ["about", "value", "choices", "allowedNets", "options", "validations", "componentProperties"],
    make: ["on", "when"],
    execute: ["with", "where"],
    generate: ["into"],
    changeCaseProperty: ["about"],
    changeUser: ["email", "name", "surname", "tel"],
    changeUserByEmail: ["email", "name", "surname", "tel"],
    changeFilter: ["query", "visibility", "allowedNets", "filterMetadata", "title", "icon"],
    changeMenuItem: ["allowedRoles", "bannedRoles", "uri", "title", "menuIcon", "tabIcon", "useCustomView", "customViewSelector"],
]

def CHAIN_ITEM_DESC = [
    "value": "Change the value of the field.",
    "about": "Change the target value (deprecated alias of `value`).",
    "choices": "Change the choices of a multichoice/enumeration field.",
    "allowedNets": "Change the allowed nets of a case-ref field.",
    "options": "Change the options of a map/enumeration-map field.",
    "validations": "Change the validations of the field.",
    "componentProperties": "Change the frontend component properties of the field.",
    "on": "Select the transition(s)/task(s) the behavior change applies to.",
    "when": "Condition under which the behavior change is applied.",
    "with": "Map of data values to set on the executed task.",
    "where": "Query predicate selecting which cases the transition runs in.",
    "into": "Target field that receives the generated value.",
    "email": "Change the user's email.",
    "name": "Change the user's name.",
    "surname": "Change the user's surname.",
    "tel": "Change the user's telephone.",
    "query": "Change the filter query.",
    "visibility": "Change the filter visibility.",
    "filterMetadata": "Change the filter metadata.",
    "title": "Change the title.",
    "icon": "Change the icon.",
    "allowedRoles": "Change the allowed roles.",
    "bannedRoles": "Change the banned roles.",
    "uri": "Change the URI/path.",
    "menuIcon": "Change the menu icon.",
    "tabIcon": "Change the tab icon.",
    "useCustomView": "Set whether a custom view is used.",
    "customViewSelector": "Set the custom view selector.",
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

def kebab = { String name -> name.replaceAll(/([a-z0-9])([A-Z])/, '$1-$2').toLowerCase() }

def normalizeType = { String t ->
    t = t.replace("java.lang.", "")
    t = t.replaceAll(/<.*>/, "")
    t = t.replaceAll(/\[\]/, "")
    if (t ==~ /[A-Z]/) t = "Object"
    if (t == "Object") t = "def"
    if (t in ["Set", "Collection"]) t = "list"
    if (t == "Closure") t = "closure"
    t
}

def javadocBlock = { int methodLine ->
    def i = methodLine - 2
    def block = []
    while (i >= 0) {
        def t = srcLines[i].trim()
        if (t == "*/") {
            def j = i
            while (j >= 0 && !srcLines[j].trim().startsWith("/**")) {
                block << srcLines[j]
                j--
            }
            if (j >= 0) block << srcLines[j]
            break
        }
        if (t != "") break
        i--
    }
    block.reverse()
}

def cleanDocLine = { String t ->
    t.replaceFirst(/^\s*\/\*\*?\s*/, "").replaceFirst(/\s*\*\/\s*$/, "").replaceFirst(/^\s*\*\s?/, "")
}

def parseJavadoc = { List block ->
    if (!block) return [summary: "", params: [:], examples: []]
    def summary = []
    def params = [:]
    def examples = []
    def inPre = false
    def preBuf = []
    block.each { raw ->
        def t = cleanDocLine(raw.trim())
        if (t ==~ /^\s*<pre>/) { inPre = true; preBuf = []; return }
        if (t ==~ /^\s*<\/pre>/) { inPre = false; if (preBuf) examples << preBuf.join("\n"); return }
        if (inPre) { preBuf << t; return }
        def m = (t =~ /^\s*@param\s+(\S+)\s+(.*)$/)
        if (m.find()) { params[m.group(1)] = m.group(2).trim(); return }
        if (t.startsWith("@")) return
        if (t) summary << t
    }
    [summary: summary.join(" ").replaceAll(/\s+/, " ").trim(), params: params, examples: examples]
}

def methodJavadoc = { int line -> parseJavadoc(javadocBlock(line)) }

def synthesize = { String name ->
    def words = name.replaceAll(/([a-z0-9])([A-Z])/, '$1 $2').toLowerCase()
    return "Manipulates ${words}."
}

// Internal runtime/implementation helpers that are not user-facing DSL actions.
def SKIP = [
    "init", "getInit", "initFieldsMap", "initTransitionsMap",
    "clearAfterExecution", "releaseAfterAsyncExecution", "retainForAsyncExecution", "clearExecutionStateIfPossible",
    "copyBehavior", "saveFieldBehavior", "saveFieldBehaviorWithTask", "saveChangedChoices", "saveChangedAllowedNets",
    "saveChangedOptions", "saveChangedValidation", "saveChangedValue", "saveTargetCase", "saveFileToField",
    "changeFieldValue", "changeFieldValidations", "executeTasks", "executeTask", "searchCases",
    "makeDataSetIntoChangedFields", "addTaskOutcomes", "addTaskOutcomeAndReturnTask", "addSetDataOutcomeToOutcomes",
    "addGetDataOutcomeToOutcomesAndReturnData", "mapData", "resolveDefaultHeaders", "createLegacyMenuItemViews",
    "createDefaultViewBody", "createSingleTaskViewBody", "updateMenuItemRoles", "updateFilter",
    "collectRolesForPreferenceItem", "createSetDataEventOutcome", "updateMultichoiceWithCurrentNode",
    "nameFromPath", "parentPath", "hasParent",
] as Set

// ---------------------------------------------------------------------------
// Collect public methods
// ---------------------------------------------------------------------------

def METHODS = []
ad.methods.each { m ->
    if (!m.isPublic()) return
    if (m.name in SKIP) return
    if (m.name in ["get", "set", "confirm", "configure", "afterPropertiesSet"]) return

    METHODS << [
        name: m.name,
        line: m.lineNumber,
        params: m.parameters.collect { p ->
            [name: p.name, type: normalizeType(p.type.name), hasDefault: p.hasInitialExpression()]
        },
        deprecated: m.annotations.any { it.classNode.nameWithoutPackage == "Deprecated" },
    ]
}

// ---------------------------------------------------------------------------
// Build entries
// ---------------------------------------------------------------------------

def buildLeaf = { Map m, String signature, String description ->
    def jd = methodJavadoc(m.line)
    def params = m.params.collect { p ->
        def pd = jd.params[p.name]
        [name: p.name, type: p.type, required: !p.hasDefault,
         description: pd ?: "Parameter ${p.name} (${p.type})."]
    }
    def leaf = [signature: signature, description: description, params: params, examples: jd.examples ?: []]
    if (m.deprecated) {
        def ordered = [signature: leaf.signature, description: leaf.description, deprecated: true, params: leaf.params, examples: leaf.examples]
        return ordered
    }
    leaf
}

def entries = [:]

METHODS.groupBy { it.name }.each { name, list ->
    // dedupe identical signatures
    def unique = list.unique { m -> m.params.collect { "${it.name}:${it.type}:${it.hasDefault}" }.join(",") }
    def key = kebab(name)
    def desc = DESCRIPTIONS[name] ?: methodJavadoc(unique[0].line).summary ?: synthesize(name)

    if (CHAIN_ITEMS.containsKey(name)) {
        // chained entry
        def entry = [description: desc]
        if (unique[0].deprecated) entry.deprecated = true
        def chain = [:]
        CHAIN_ITEMS[name].each { item ->
            chain[item] = [
                signature: "${name} <target> ${item} <closure>",
                description: CHAIN_ITEM_DESC[item] ?: "Set/change '${item}' of the target.",
                params: [[name: "closure", type: "closure", required: true, description: "Groovy closure producing the '${item}' value."]],
                examples: [],
            ]
        }
        entry.dslChain = chain
        entries[key] = entry

    } else if (unique.size() > 1) {
        def entry = [description: desc]
        if (unique[0].deprecated) entry.deprecated = true
        entry.alts = unique.collect { m ->
            def sig = "$m.name " + m.params.collect { "<${it.name}>" }.join(", ")
            buildLeaf(m, sig, desc)
        }
        entries[key] = entry

    } else {
        def m = unique[0]
        def sig = "$m.name " + m.params.collect { "<${it.name}>" }.join(", ")
        entries[key] = buildLeaf(m, sig, desc)
    }
}

// ---------------------------------------------------------------------------
// Merge hand-tuned entries (from the existing actions-def.json).
// The hand-tuned entry wins, but for chained entries any chain items present in
// the mechanically-generated version that the hand-tuned entry doesn't cover are
// preserved (so the full DSL chain is documented).
// ---------------------------------------------------------------------------
def existing = new File("src/public/fallback/actions-def.json")
if (existing.exists()) {
    def curated = new JsonSlurper().parse(existing)
    curated.each { k, v ->
        if (v instanceof Map && v.containsKey("dslChain") && entries[k] instanceof Map && entries[k].containsKey("dslChain")) {
            def merged = entries[k].dslChain + v.dslChain   // mechanical first, curated overrides per item
            entries[k].dslChain = merged
            if (v.containsKey("description")) entries[k].description = v.description
        } else {
            entries[k] = v
        }
    }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------
def json = JsonOutput.prettyPrint(JsonOutput.toJson(entries))
outFile.parentFile.mkdirs()
outFile.text = json + "\n"
println "Generated ${outFile} with ${entries.size()} actions"