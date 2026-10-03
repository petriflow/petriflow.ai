// AUTO-GENERATED from the NAE ActionDelegate.groovy by src/groovy/tools/generate-delegate.groovy
// Do not edit by hand. Regenerate with: groovy src/groovy/tools/generate-delegate.groovy <path-to-ActionDelegate.groovy>
// Stripped ActionDelegate: full DSL method surface, no Spring/NAE runtime deps.

import groovy.transform.CompileStatic

// --- Stub types (stand-ins for NAE domain classes) ---
class Stub {
    Stub value
    String stringId
    String importId
    def getAt(int i) { null }
    def getAt(String k) { null }
}
class AbstractUser extends Stub {
    String fullName
    String email
}
class Action extends Stub {}
class Case extends Stub {
    String title
    String color
    PetriNet petriNet
    Map dataSet
    List tasks
}
class CaseField extends Field {}
class ChoiceField extends Field {}
class DashboardItemBody extends Stub {}
class DashboardManagementBody extends Stub {}
class DynamicValidation extends Stub {}
class EventOutcome extends Stub {}
class ExportDataConfig extends Stub {}
class Field extends Stub {
    Object type
    Map options
    Object choices
    Object defaultValue
    Map behavior
    Object validations
}
class FieldActionsRunner extends Stub {}
class FileField extends Field {}
class FileFieldInputStream extends Stub {}
class FileFieldValue extends Stub {}
class FilterBody extends Stub {}
class FrontendActionOutcome extends Stub {}
class GetDataEventOutcome extends Stub {}
class I18nString extends Stub {
}
class LoggedUser extends Stub {}
class MailDraft extends Stub {}
class MapOptionsField extends Field {}
class MenuItemBody extends Stub {}
class MessageResource extends Stub {}
class ModuleHolder extends Stub {}
class MultichoiceMapField extends Field {}
class NewUserRequest extends Stub {}
class Nullable extends Stub {}
class Page extends Stub {}
class Pageable extends Stub {}
class PetriNet extends Stub {
    Map transitions
    Map dataSet
}
class PluginHolder extends Stub {}
class SetDataEventOutcome extends Stub {}
class TabbedCaseViewBody extends Stub {}
class Task extends Stub {
    String caseId
    String transitionId
    Map dataSet
}
class TaskEventOutcome extends Stub {}
class Transition extends Stub {
    Map dataSet
}
class Validation extends Stub {}
class Version extends Stub {}
class ViewBody extends Stub {}

// --- Typed DSL chain results ---
class ChangeResult {
    def value(Closure c) { null }
    def about(Closure c) { null }
    def choices(Closure c) { null }
    def allowedNets(Closure c) { null }
    def options(Closure c) { null }
    def validations(Closure c) { null }
    def componentProperties(Closure c) { null }
}
class CasePropertyResult {
    def about(Closure c) { null }
}
class MakeResult {
    MakeOnResult on(Object o) { null }
}
class MakeOnResult {
    void when(Closure c) {}
}
class ExecuteResult {
    void with(Map m) {}
    ExecuteResult where(Closure c) { null }
}
class GenerateResult {
    def into(Field field) { null }
}

class ActionDelegate {

    static final String UNCHANGED_VALUE = "unchangedooo"
    static final String ALWAYS_GENERATE = "always"
    static final String ONCE_GENERATE = "once"
    static final String TRANSITIONS = "transitions"
    static final String GLOBAL_ROLE = "GLOBAL_ROLE"

    Closure visible = null
    Closure editable = null
    Closure required = null
    Closure optional = null
    Closure hidden = null
    Closure forbidden = null
    Closure initial = null
    Closure unchanged = null
    Closure transitions = null
    Closure initValueOfField = null
    Closure close = null
    Closure always = null
    Closure once = null
    Closure byCode = null
    Closure byCity = null
    Closure byIco = null
    Case useCase = null
    Optional<Task> task = null
    Map<String, String> params = null
    Action action = null
    FieldActionsRunner actionsRunner = null
    List<EventOutcome> outcomes = null
    FrontendActionOutcome Frontend = null
    ModuleHolder NaeModule = null
    PluginHolder Plugin = null
    Map map = null

    def init(Action action, Case useCase, Optional task, FieldActionsRunner actionsRunner, Map params = null) { null }
    void retainForAsyncExecution() {}
    void releaseAfterAsyncExecution() {}
    void clearAfterExecution() {}
    void clearExecutionStateIfPossible() {}
    def initFieldsMap(Map fieldIds) { null }
    def initTransitionsMap(Map transitionIds) { null }
    def copyBehavior(Field field, Transition transition, Case useCase = null) { null }
    def getInit() { null }
    def init(Field field) { null }
    MakeResult make(Field field, Closure behavior) { null }
    MakeResult make(List fields, Closure behavior) { null }
    void saveFieldBehaviorWithTask(Field field, Task task, Closure behavior, Object behaviorClosureResult) {}
    def createSetDataEventOutcome(Case useCase = null, Optional task = null) { null }
    def saveFieldBehavior(Field field, Transition trans, Set initialBehavior, Case targetCase = null, Optional targetTask = null) { null }
    def saveChangedChoices(ChoiceField field, Case targetCase = null, Optional targetTask = null) { null }
    def saveChangedAllowedNets(CaseField field, Case targetCase = null, Optional targetTask = null) { null }
    def saveChangedOptions(MapOptionsField field, Case targetCase = null, Optional targetTask = null) { null }
    def saveChangedValidation(Field field, Case targetCase = null, Optional targetTask = null) { null }
    ExecuteResult execute(String taskId) { null }
    ExecuteResult execute(Task task) { null }
    void executeTasks(Map dataSet, String taskId, Closure predicateClosure) {}
    void executeTask(String transitionId, Map dataSet) {}
    def addTaskOutcomes(Task task, Map dataSet) { null }
    def searchCases(Closure predicates) { null }
    ChangeResult change(String fieldId, String caseId, String taskId = null) { null }
    ChangeResult change(Field field, Case targetCase = null, Optional targetTask = null) { null }
    void changeFieldValue(Field field, Object cl, Case targetCase = null, Optional targetTask = null) {}
    def saveTargetCase(Case targetCase) { null }
    def saveChangedValue(Field field, Case targetCase = null) { null }
    void changeFieldValidations(Field field, Object cl, Case targetCase = null, Optional targetTask = null) {}
    GenerateResult generate(String methods, Closure repeated) { null }
    CasePropertyResult changeCaseProperty(String property) { null }
    def cache(String name, Object value) { null }
    def cache(String name) { null }
    def cacheFree(String name) { null }
    def psc(Closure find, String input) { null }
    def orsr(Closure find, String ico) { null }
    def nullable(Object value) { null }
    def get(String key) { null }
    void set(String key, Object value) {}
    def findCases(Closure predicate) { null }
    def findCases(Closure predicate, Pageable pageable) { null }
    def findCase(Closure predicate) { null }
    def findCase(String stringId) { null }
    def createCase(String identifier, String title = null, String color = null, AbstractUser author = null, Locale locale = null, Map params = null) { null }
    def createCase(PetriNet net, String title = null, String color = null, AbstractUser author = null, Locale locale = null, Map params = null) { null }
    def deleteCase(Case useCase) { null }
    def deleteCase(String caseId) { null }
    def assignTask(String transitionId, Case aCase = null, AbstractUser user = null, Map params = null) { null }
    def assignTask(Task task, AbstractUser user = null, Map params = null) { null }
    void assignTasks(List tasks, AbstractUser assignee = null, Map params = null) {}
    def cancelTask(String transitionId, Case aCase = null, AbstractUser user = null, Map params = null) { null }
    def cancelTask(Task task, AbstractUser user = null, Map params = null) { null }
    void cancelTasks(List tasks, AbstractUser user = null, Map params = null) {}
    def addTaskOutcomeAndReturnTask(TaskEventOutcome outcome) { null }
    void finishTask(String transitionId, Case aCase = null, AbstractUser user = null, Map params = null) {}
    void finishTask(Task task, AbstractUser user = null, Map params = null) {}
    void finishTasks(List tasks, AbstractUser finisher = null, Map params = null) {}
    def findTasks(Closure predicate) { null }
    def findTasks(Closure predicate, Pageable pageable) { null }
    def findTask(Closure predicate) { null }
    def findTask(String mongoId) { null }
    def getTaskId(String transitionId, Case aCase = null) { null }
    def assignRole(String roleMongoId, AbstractUser user = null) { null }
    def assignRole(String roleId, String netId, AbstractUser user = null, Pageable pageable = null) { null }
    def assignRole(String roleId, PetriNet net, AbstractUser user = null) { null }
    def assignRole(String roleId, String netId, Version version, AbstractUser user = null) { null }
    def removeRole(String roleMongoId, AbstractUser user = null) { null }
    def removeRole(String roleId, String netId, AbstractUser user = null, Pageable pageable = null) { null }
    def removeRole(String roleId, PetriNet net, AbstractUser user = null) { null }
    def removeRole(String roleId, String netId, Version version, AbstractUser user = null) { null }
    def setData(Task task, Map dataSet, Map params = null) { null }
    def setData(String taskId, Map dataSet, Map params = null) { null }
    def setData(Transition transition, Map dataSet, Map params = null) { null }
    def setData(String transitionId, Case useCase, Map dataSet, Map params = null) { null }
    def setDataWithPropagation(String transitionId, Case caze, Map dataSet) { null }
    def setDataWithPropagation(Task task, Map dataSet) { null }
    def setDataWithPropagation(String taskId, Map dataSet) { null }
    def addSetDataOutcomeToOutcomes(SetDataEventOutcome outcome) { null }
    def makeDataSetIntoChangedFields(Map map, Case caze, Task task) { null }
    def getData(Task task, Map params = null) { null }
    def getData(String taskId, Map params = null) { null }
    def getData(Transition transition, Map params = null) { null }
    def getData(String transitionId, Case useCase, Map params = null) { null }
    def addGetDataOutcomeToOutcomesAndReturnData(GetDataEventOutcome outcome) { null }
    def mapData(List data) { null }
    def loggedUser() { null }
    void saveFileToField(Case targetCase, String targetTransitionId, String targetFieldId, String filename, String storagePath = null) {}
    void generatePdf(String sourceTransitionId, String targetFileFieldId, Case sourceCase = null, Case targetCase = null, String targetTransitionId = null, String template = null, List excludedFields = null, Locale locale = null, ZoneId dateZoneId = null, Integer sideMargin = null, Integer titleMargin = null) {}
    void generatePdf(Transition sourceTransition, FileField targetFileField, Case sourceCase = null, Case targetCase = null, Transition targetTransition = null, String template = null, List excludedFields = null, Locale locale = null, ZoneId dateZoneId = null, Integer sideMargin = null, Integer titleMargin = null) {}
    void generatePDF(String sourceTransitionId, String targetFileFieldId, Case sourceCase = null, Case targetCase = null, String targetTransitionId = null, String template = null, List excludedFields = null, Locale locale = null, ZoneId dateZoneId = null, Integer sideMargin = null, Integer titleMargin = null) {}
    void generatePDF(Transition sourceTransition, FileField targetFileField, Case sourceCase = null, Case targetCase = null, Transition targetTransition = null, String template = null, List excludedFields = null, Locale locale = null, ZoneId dateZoneId = null, Integer sideMargin = null, Integer titleMargin = null) {}
    void generatePdf(String transitionId, FileField fileField, List excludedFields = null) {}
    void generatePdf(String transitionId, String fileFieldId, List excludedFields, Case fromCase = null, Case saveToCase = null) {}
    void generatePdfWithTemplate(String transitionId, String fileFieldId, String template, Case fromCase = null, Case saveToCase = null) {}
    void generatePdfWithLocale(String transitionId, String fileFieldId, Locale locale, Case fromCase = null, Case saveToCase = null) {}
    void generatePdfWithZoneId(String transitionId, String fileFieldId, ZoneId dateZoneId = null, Case fromCase = null, Case saveToCase = null) {}
    void sendEmail(List to, String subject, String body) {}
    void sendEmail(List to, String subject, String body, Map attachments) {}
    void sendMail(MailDraft mailDraft) {}
    def changeUserByEmail(String email) { null }
    def changeUser(String id) { null }
    def changeUser(AbstractUser user) { null }
    def changeUserByEmail(String email, String attribute, Object cl) { null }
    def changeUser(String id, String attribute, Object cl) { null }
    def changeUser(AbstractUser user, String attribute, Object cl) { null }
    def inviteUser(String email) { null }
    def inviteUser(NewUserRequest newUserRequest) { null }
    void deleteUser(String email) {}
    void deleteUser(AbstractUser user) {}
    def findUserByEmail(String email) { null }
    def findUserById(String id) { null }
    def validation(String rule, I18nString message) { null }
    def dynamicValidation(String rule, I18nString message) { null }
    def findFilters(String userInput) { null }
    def findAllFilters() { null }
    def exportFilters(Collection filtersToExport) { null }
    def importFilters() { null }
    def exportCasesToFile(Closure predicate, String pathName, ExportDataConfig config = null, int pageSize = null) { null }
    def exportCases(Closure predicate, File outFile, ExportDataConfig config = null, int pageSize = null) { null }
    def exportCasesToFile(List requests, String pathName, ExportDataConfig config = null, LoggedUser user = null, int pageSize = null, Locale locale = null, Boolean isIntersection = null) { null }
    def exportCases(List requests, File outFile, ExportDataConfig config = null, LoggedUser user = null, int pageSize = null, Locale locale = null, Boolean isIntersection = null) { null }
    def exportTasksToFile(Closure predicate, String pathName, ExportDataConfig config = null) { null }
    def exportTasks(Closure predicate, File outFile, ExportDataConfig config = null, int pageSize = null) { null }
    def exportTasksToFile(List requests, String pathName, ExportDataConfig config = null, LoggedUser user = null, int pageSize = null, Locale locale = null, Boolean isIntersection = null) { null }
    def exportTasks(List requests, File outFile, ExportDataConfig config = null, LoggedUser user = null, int pageSize = null, Locale locale = null, Boolean isIntersection = null) { null }
    def getFileFieldStream(Case useCase, Task task, FileField field, boolean forPreview = null) { null }
    def findCasesElastic(List requests, LoggedUser loggedUser = null, int page = null, int pageSize = null, Locale locale = null, boolean isIntersection = null) { null }
    def findCasesElastic(Map request, LoggedUser loggedUser = null, int page = null, int pageSize = null, Locale locale = null, boolean isIntersection = null) { null }
    def findTasks(List requests, LoggedUser loggedUser = null, int page = null, int pageSize = null, Locale locale = null, boolean isIntersection = null) { null }
    def findTasks(Map request, LoggedUser loggedUser = null, int page = null, int pageSize = null, Locale locale = null, boolean isIntersection = null) { null }
    def findDefaultFilters() { null }
    def createCaseFilter(Object title, String query, List allowedNets, String icon = null, String visibility = null, Object filterMetadata = null) { null }
    def createTaskFilter(Object title, String query, List allowedNets, String icon = null, String visibility = null, Object filterMetadata = null) { null }
    def createFilter(Object title, String query, String type, List allowedNets, String icon, String visibility, Object filterMetadata) { null }
    def changeFilter(Case filter) { null }
    def deleteFilter(Case filter) { null }
    def createMenuItem(String uri, String identifier, Case filter, String groupName, Map allowedRoles, Map bannedRoles = null, List caseDefaultHeaders = null, List taskDefaultHeaders = null) { null }
    def createMenuItem(String uri, String identifier, Case filter, String groupName, List allowedRoles, List bannedRoles = null, List caseDefaultHeaders = null, List taskDefaultHeaders = null) { null }
    def createMenuItem(String uri, String identifier, Case filter, Map allowedRoles, Map bannedRoles = null, Case group = null, List caseDefaultHeaders = null, List taskDefaultHeaders = null) { null }
    def createMenuItem(String uri, String identifier, Case filter, List allowedRoles, List bannedRoles = null, Case group = null, List caseDefaultHeaders = null, List taskDefaultHeaders = null) { null }
    def createMenuItem(String uri, String identifier, Object name, String icon = null, Case filter = null, Map allowedRoles = null, Map bannedRoles = null, List caseDefaultHeaders = null, List taskDefaultHeaders = null) { null }
    def changeMenuItem(Case item) { null }
    void updateMenuItemRoles(Case item, Closure cl, String roleFieldId) {}
    def deleteMenuItem(Case item) { null }
    def createFilterInMenu(String uri, String identifier, Object title, String query, String type, List allowedNets, String groupName, Map allowedRoles = null, Map bannedRoles = null, List defaultHeaders = null, String icon = null, String visibility = null) { null }
    def createFilterInMenu(String uri, String identifier, Object title, String query, String type, List allowedNets, Map allowedRoles = null, Map bannedRoles = null, List defaultHeaders, String icon = null, String visibility = null, Case orgGroup = null) { null }
    def createFilterInMenu(String uri, String itemIdentifier, Object itemAndFilterName, String filterQuery, String filterType, String filterVisibility, List filterAllowedNets = null, String itemAndFilterIcon = null, Map itemAllowedRoles = null, Map itemBannedRoles = null, List itemCaseDefaultHeaders = null, List itemTaskDefaultHeaders = null, Object filterMetadata = null) { null }
    def createFilterInMenu(MenuItemBody body, String filterQuery, String filterType, String filterVisibility, List filterAllowedNets = null, Object filterMetadata = null) { null }
    def createMenuItem(MenuItemBody body) { null }
    def getOrCreateMenuItem(MenuItemBody body) { null }
    def createSingleTaskViewBody(MenuItemBody body, String filterQuery, String transitionId, List filterAllowedNets = null, List defaultHeaders = null, String filterType = null, String filterVisibility = null, Object filterMetadata = null) { null }
    def createDefaultViewBody(MenuItemBody body, String filterQuery, List filterAllowedNets = null, List defaultHeaders = null, String filterType = null, String filterVisibility = null, Object filterMetadata = null) { null }
    void resolveDefaultHeaders(TabbedCaseViewBody viewBody, List defaultHeaders) {}
    def createLegacyMenuItemViews(Case filterCase, List caseDefaultHeaders = null, List taskDefaultHeaders = null) { null }
    def createLegacyMenuItemViews(FilterBody filterBody, List caseDefaultHeaders = null, List taskDefaultHeaders = null) { null }
    def nameFromPath(String path) { null }
    def parentPath(String path) { null }
    def hasParent(String path) { null }
    void moveMenuItem(Case item, String destUri) {}
    def duplicateMenuItem(Case originItem, I18nString newTitle, String newIdentifier) { null }
    def findFilter(String name) { null }
    def findMenuItem(String menuItemIdentifier) { null }
    def findFolderCase(String path) { null }
    def existsMenuItem(String menuItemIdentifier) { null }
    def findMenuItem(String uri, String name) { null }
    def findMenuItem(String uri, String name, String groupName) { null }
    def findMenuItemInGroup(String uri, String name, Case orgGroup) { null }
    def createDashboardManagement(DashboardManagementBody body) { null }
    def createDashboardItem(DashboardItemBody body) { null }
    def findDashboardManagement(String identifier) { null }
    def findDashboardItem(String identifier) { null }
    def updateDashboardManagement(Case managementCase, DashboardManagementBody body) { null }
    def updateDashboardItem(Case itemCase, DashboardItemBody body) { null }
    def findCaseElastic(String query) { null }
    def findCasesElastic(String query, int pageSize = null) { null }
    def findCasesElastic(String query, Pageable pageable) { null }
    def countCasesElastic(String query) { null }
    def findMenuItemByUriNameProcessAndGroup(String uri, String name, Case orgGroup) { null }
    def collectRolesForPreferenceItem(List roles) { null }
    def collectRolesForPreferenceItem(Map roles) { null }
    void updateFilter(Case filter, Map dataSet) {}
    def i18n(String value, Map translations) { null }
    def createMenuItem(String id, String uri, String query, String icon, String title, List allowedNets, Map roles, Map bannedRoles = null, Case group = null, List defaultHeaders = null) { null }
    def createTaskMenuItem(String id, String uri, String query, String icon, String title, List allowedNets, Map roles, Case group = null, List defaultHeaders = null) { null }
    def createOrUpdateCaseMenuItem(String id, String uri, String query, String icon, String title, List allowedNets, Map roles = null, Map bannedRoles = null, Case group = null, List defaultHeaders = null) { null }
    def createOrUpdateTaskMenuItem(String id, String uri, String query, String icon, String title, List allowedNets, Map roles = null, Map bannedRoles = null, Case group = null, List defaultHeaders = null) { null }
    def createOrUpdateMenuItem(String id, String uri, String type, String query, String icon, String title, List allowedNets, Map roles = null, Map bannedRoles = null, Case group = null, List defaultHeaders = null) { null }
    def createOrUpdateMenuItem(String uri, String identifier, Object name, String icon = null, Case filter = null, Map allowedRoles = null, Map bannedRoles = null, List caseDefaultHeaders = null, List taskDefaultHeaders = null) { null }
    def createOrUpdateMenuItemAndFilter(String uri, String itemIdentifier, Object itemAndFilterName, String filterQuery, String filterType, String filterVisibility, List filterAllowedNets = null, String itemAndFilterIcon = null, Map itemAllowedRoles = null, Map itemBannedRoles = null, List itemCaseDefaultHeaders = null, List itemTaskDefaultHeaders = null, Object filterMetadata = null) { null }
    def createOrUpdateMenuItem(MenuItemBody body) { null }
    def createOrUpdateMenuItemAndFilter(MenuItemBody body, String filterQuery, String filterType, String filterVisibility, List filterAllowedNets = null, Object filterMetadata = null) { null }
    def createOrIgnoreMenuItem(MenuItemBody body) { null }
    def createOrIgnoreMenuItemAndFilter(MenuItemBody body, String filterQuery, String filterType, String filterVisibility, List filterAllowedNets = null, Object filterMetadata = null) { null }
    def updateMenuItem(Case item, MenuItemBody body) { null }
    def defaultFilterMetadata(String type) { null }
    void removeChildItemFromParent(String folderId, Case childItem) {}
    def makeUrl(String publicViewUrl, String identifier) { null }
    def makeUrl(String identifier) { null }
    void updateMultichoiceWithCurrentNode(MultichoiceMapField field, String path) {}
    def splitUriPath(String path) { null }
    def findOptionsBasedOnSelectedNode(String path) { null }
    def findOptionsBasedOnSelectedNode(String path, List splitPathList) { null }
    def getCorrectedUri(String uncheckedPath) { null }
    def getFieldOfTask(String taskId, String fieldId) { null }
    def resolveStoragePath(Case aCase, String fileFieldId, String fileName) { null }

    // Loose overloads for dynamically-typed function bodies.
    ChangeResult change(Object field, Case targetCase = null, Optional targetTask = null) { null }
    MakeResult make(Object fieldOrList, Closure behavior) { null }
}
