# Petriflow — Language Overview

Petriflow is a process-centric language for executable business processes. One XML document (`<document>`) describes one
**process**: a Petri net that defines the control flow, plus **roles** (who), **data** (what), and **actions** (how the
process reacts). Running the process creates **cases** — independent instances, each with its own marking and its own
data values. Read this first to get the mental model; look up exact syntax in the schema and element definitions.

## Building blocks

| Concept             | Meaning                                                                                                                                    |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Place               | A state or condition. Holds tokens. `tokens` sets the initial marking.                                                                     |
| Transition          | A unit of work. Within a case, an enabled transition is a **task** that users or the system execute.                                       |
| Arc                 | Connects a place to a transition or a transition to a place, never the same kind of node. Has a static or dynamic weight (`multiplicity`). |
| Data field          | A variable of the process. Every case has its own value, shared by all tasks of that case.                                                 |
| dataRef / dataGroup | Places a field on a task form with a behaviour (`editable`, `visible`, `required`, ...).                                                   |
| Role / roleRef      | A named group of users. `roleRef` grants permissions on a task or on the whole case.                                                       |
| actorRef            | Grants permissions to the users stored in an `actor` / `actorList` field of the specific case.                                             |
| Event               | A lifecycle point of a process, case, task, or data field. Each has a `pre` and a `post` phase.                                            |
| Action              | Groovy code attached to an event phase. It calls events on data fields and tasks of this or other cases.                                   |
| Function            | A reusable Groovy closure (`process`, `namespace`, or `global` scope) callable from actions.                                               |
| i18n                | Translations of titles, labels, and options.                                                                                               |

## Execution model

**Enabling.** A transition is enabled when every input arc is satisfied:

| Arc type    | Enables when                                                     | Effect when the task runs                                                                      |
|-------------|------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| `regular`   | place has at least *weight* tokens                               | consumes *weight* tokens; on an output arc, produces them                                      |
| `read`      | place has at least *weight* tokens                               | nothing is consumed (condition does not have stay true if there are other arcs from the place) |
| `inhibitor` | place has fewer than *weight* tokens (weight 1 = place is empty) | nothing is consumed                                                                            |
| `reset`     | always                                                           | removes all tokens from the place                                                              |

A `reference` on an arc makes its weight dynamic. It points to a `number` field or a place, and the weight is read when
the arc is executed. A weight of 0 moves no tokens. This is how data drives routing.

**Task lifecycle.** An enabled transition appears as a task to users who may perform it.

1. **assign** — pre-assign actions → **input tokens are consumed** → post-assign actions. The task now belongs to one
   user. Other tasks that needed the same tokens disappear (this does not apply if two tasks tests only via read arcs to
   the same place).
2. The user fills in the form. Every value change fires the field's `set` event; reading fires `get`.
3. **finish** — required fields are checked and validated → pre-finish actions → **output tokens are produced** → newly
   enabled tasks
   are created → post-finish actions.
4. **cancel** (instead of finish) — pre-cancel actions → consumed tokens are returned → post-cancel actions.
5. **delegate** — hands the assigned task to another user.

Because outputs are produced between the pre and post phases of finish, the weights of variable output arcs must be
set **before** that point: in the finish `pre` phase or earlier (for example in a field's `set` event).

**Choices.** An *explicit choice* is one task whose output arcs reference number fields that its actions set to 1 or 0.
A *deferred choice* is several tasks that share one input place: whichever is assigned first takes the token and the
others disappear.

**Automatic work.** A task with `<trigger type="auto"/>` runs (assign and finish) as soon as it is enabled. A `time`
trigger runs it after a delay or at an exact time. Actions can also assign and finish tasks. A task that no user may
perform only moves forward through a trigger or an action, and only while it is enabled.

**Data and forms.** A field is declared once in `<data>`. A task form is the list of fields the transition references,
each with a behaviour for that task: `forbidden`, `hidden`, `visible`, `editable`, `required`, `optional`, or
`immediate`. Actions can change behaviour at runtime (`make`). Field types fall into these groups:

- simple values: `text`, `number`, `boolean`, `date`, `dateTime`
- selections: `enumeration`, `multichoice`, and their `_map` variants, which store the option key rather than its label
- files: `file`, `fileList`
- users: `actor`, `actorList`
- UI: `button`, `i18n` (static text)
- references: `taskRef` (embeds other tasks' forms), `caseRef`, `processRef`
- filters: `caseFilter`, `taskFilter`, `processFilter`

**Indexed fields (`immediate="true"`).** Only fields declared with the `immediate="true"` attribute on `<data>` have
their value copied into the Elasticsearch case index (`dataSet.<fieldId>`). Everything that searches or lists cases by
a field value depends on it: Elasticsearch queries such as `findCasesElastic("... AND dataSet.<fieldId>...")` in actions,
the filter query of a menu item, and the field columns (headers `<processId>-<fieldId>`) of a case list. A field
without `immediate="true"` is stored in the case, but queries on it find nothing and its list column has no value. Mark
the fields you search by or show in case lists.

**Roles and permissions.** Task permissions are `perform` (shorthand for assign, finish, cancel, and view), `assign`,
`finish`, `cancel`, `view`, and `delegate`. Case permissions (`caseLogic`) are `create`, `view`, and `delete`. Every
process has two built-in roles that are never declared: `default` (any logged-in user) and `anonymous`. They are
switched on by `<defaultRole>` and `<anonymousRole>`, and **both default to `true`**. A transition with no `roleRef` or
`actorRef` is open to every enabled built-in role.

**Events.** There are events at four levels, and every one has a `pre` and a `post` phase:

- process: `upload`
- case: `create`, `delete`
- task: `assign`, `finish`, `cancel`, `delegate`
- data field: `set`, `get`
- data reference (`dataRef`):  `set`, `get` (triggered only on given task form)

An action starts with a header that binds the fields (`f.`) and transitions (`t.`) it uses, followed by Groovy code
that calls the action DSL:

```groovy
approved: f.approved, go_yes: f.go_yes, go_no: f.go_no;
change go_yes value { approved.value ? 1 : 0 }
change go_no value { approved.value ? 0 : 1 }
```

**Multiple processes.** Each process is a separate document. Cases of different processes interact only through
actions — creating and finding cases, assigning and finishing their tasks, setting data on them — and through reference
fields: `taskRef` embeds the forms of other tasks, which must be enabled, and `caseRef` links cases. A case keeps the
process version it was created with, so fields added in a later version do not exist in older cases.

## Minimal example

The `submit` transition has no `roleRef`, so any logged-in user can submit. A manager then decides, and the decision
routes the token through variable arcs.

```xml

<document xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:noNamespaceSchemaLocation="https://petriflow.com/petriflow.schema.xsd">
  <id>leave_request</id>
  <version>1.0.0</version>
  <initials>LRQ</initials>
  <title>Leave request</title>
  <defaultRole>true</defaultRole>
  <anonymousRole>false</anonymousRole>
  <role>
    <id>manager</id>
    <title>Manager</title>
  </role>
  <data type="text">
    <id>reason</id>
    <title>Reason</title>
  </data>
  <data type="boolean">
    <id>approved</id>
    <title>Approve</title>
    <init>false</init>
  </data>
  <data type="number">
    <id>go_yes</id>
    <title/>
    <init>0</init>
  </data>
  <data type="number">
    <id>go_no</id>
    <title/>
    <init>0</init>
  </data>
  <transition>
    <id>submit</id>
    <x>200</x>
    <y>100</y>
    <label>Submit request</label>
    <dataRef>
      <id>reason</id>
      <logic>
        <behavior>editable</behavior>
        <behavior>required</behavior>
      </logic>
    </dataRef>
  </transition>
  <transition>
    <id>decide</id>
    <x>400</x>
    <y>100</y>
    <label>Decide</label>
    <roleRef>
      <id>manager</id>
      <logic>
        <perform>true</perform>
      </logic>
    </roleRef>
    <dataRef>
      <id>reason</id>
      <logic>
        <behavior>visible</behavior>
      </logic>
    </dataRef>
    <dataRef>
      <id>approved</id>
      <logic>
        <behavior>editable</behavior>
      </logic>
    </dataRef>
    <event type="finish">
      <id>decide_finish</id>
      <actions phase="pre">
        <action id="decide_route"><![CDATA[
        approved: f.approved, go_yes: f.go_yes, go_no: f.go_no;
        change go_yes value { approved.value ? 1 : 0 }
        change go_no value { approved.value ? 0 : 1 }
      ]]></action>
      </actions>
    </event>
  </transition>
  <place>
    <id>created</id>
    <x>100</x>
    <y>100</y>
    <label>Created</label>
    <tokens>1</tokens>
    <static>false</static>
  </place>
  <place>
    <id>submitted</id>
    <x>300</x>
    <y>100</y>
    <label>Submitted</label>
    <tokens>0</tokens>
    <static>false</static>
  </place>
  <place>
    <id>accepted</id>
    <x>500</x>
    <y>40</y>
    <label>Accepted</label>
    <tokens>0</tokens>
    <static>false</static>
  </place>
  <place>
    <id>rejected</id>
    <x>500</x>
    <y>160</y>
    <label>Rejected</label>
    <tokens>0</tokens>
    <static>false</static>
  </place>
  <arc>
    <id>a1</id>
    <type>regular</type>
    <sourceId>created</sourceId>
    <destinationId>submit</destinationId>
    <multiplicity>1</multiplicity>
  </arc>
  <arc>
    <id>a2</id>
    <type>regular</type>
    <sourceId>submit</sourceId>
    <destinationId>submitted</destinationId>
    <multiplicity>1</multiplicity>
  </arc>
  <arc>
    <id>a3</id>
    <type>regular</type>
    <sourceId>submitted</sourceId>
    <destinationId>decide</destinationId>
    <multiplicity>1</multiplicity>
  </arc>
  <arc>
    <id>a4</id>
    <type>regular</type>
    <sourceId>decide</sourceId>
    <destinationId>accepted</destinationId>
    <multiplicity>0</multiplicity>
    <reference>go_yes</reference>
  </arc>
  <arc>
    <id>a5</id>
    <type>regular</type>
    <sourceId>decide</sourceId>
    <destinationId>rejected</destinationId>
    <multiplicity>0</multiplicity>
    <reference>go_no</reference>
  </arc>
</document>
```

## How to model a process

1. **Cases** — decide what one case represents. Split independent lifecycles (an order and its invoices, for example)
   into separate processes.
2. **States** — list the states a case passes through. These become places; put the initial token in the start place.
3. **Tasks** — add the work that moves a case between states as transitions, and connect them with arcs.
4. **Routing** — model parallelism with one transition that has several output arcs, choices with variable arcs or
   competing tasks, and merges with a shared place.
5. **Roles** — declare roles and give every human task a `roleRef`. Use `actorRef` when access depends on the
   individual case (its owner, assignee, and so on).
6. **Data and forms** — declare the fields once, then reference them on each task with the right behaviour.
7. **Actions** — add routing values, computations, automation, and links to other processes.

## Core pitfalls

- **Merging alternatives into one transition creates an AND-join.** A transition with several input places waits for
  tokens in *all* of them. To merge mutually exclusive branches, send them into one shared place.
- **A place with several output arcs is a choice, not a split.** Only one task gets the token. To run branches in
  parallel, give one transition several output arcs.
- **An inclusive (OR) split needs a matching join.** If only some branches get a token, the joining transition must
  expect only those: reference the same routing fields on its input arcs too.
- **Set routing values before the tokens move.** Set them in the finish `pre` phase or earlier. In `post`, the tokens
  have already been produced with the old weights.
- **Every place that feeds a transition must be able to receive a token**, either from the initial marking or from an
  incoming arc. Otherwise the task never appears, and no error is reported.
- **A task that is always available needs a read arc** from a place that keeps its token, and no regular arc
  consuming that token. A regular input arc makes it a one-time task.
- **Tasks nobody can perform need a trigger or an action**, or the case gets stuck there.
- **Data is shared by the whole case.** Do not copy values between tasks of the same case. Control what each task
  shows through behaviours, and use `_map` selection types when actions compare option keys.
- **Ids must be valid Java identifiers.** This applies to every element id (places, transitions, arcs, fields,
  roles, ...) and to action ids, so `id="1"` is not allowed. Reserved Java and Groovy words (`new`, `class`, `def`, ...)
  are not allowed either.
- **Fields you search or list need `immediate="true"`.** Without it the Elasticsearch case index has no value for the
  field, so queries on `dataSet.<fieldId>` and menu item filters return no cases and case list columns stay empty.
- **Set `<defaultRole>` and `<anonymousRole>` explicitly.** Both default to `true`, and a task without a `roleRef` is
  open to every enabled built-in role, including anonymous users.

## Where to find details

- **Schema** — the complete XSD; the authority for element names and order.
- **Element definitions** — the XSD of individual elements (`transition`, `data`, `arc`, `role`, events, ...).
- **Action definitions** — the action DSL and the available functions, with signatures and examples.
- **Component definitions** — the field components selectable with `<component><name>` (textarea, currency, stepper, ...),
  with when to use each one and its `<property>` configuration.
- **Examples** — complete annotated applications, plus a catalogue of classic workflow patterns (sequence, parallel
  split, synchronization, exclusive choice, merge, loops, milestone, critical section, ...).
- **Validator** — checks a process document against the schema and semantic rules, including that actions compile.

Recommended loop: start from the closest example → check unfamiliar elements and actions → write the process →
validate → fix → validate again.
