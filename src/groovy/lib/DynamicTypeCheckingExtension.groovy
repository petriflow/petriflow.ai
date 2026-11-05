import org.codehaus.groovy.transform.stc.TypeCheckingExtension
import org.codehaus.groovy.transform.stc.StaticTypeCheckingVisitor
import org.codehaus.groovy.transform.stc.StaticTypeCheckingSupport
import org.codehaus.groovy.transform.stc.StaticTypesMarker
import org.codehaus.groovy.ast.ClassHelper
import org.codehaus.groovy.ast.ClassNode
import org.codehaus.groovy.ast.MethodNode
import org.codehaus.groovy.ast.Parameter
import org.codehaus.groovy.ast.expr.ArgumentListExpression
import org.codehaus.groovy.ast.expr.Expression
import org.codehaus.groovy.ast.expr.MethodCall
import org.codehaus.groovy.ast.expr.PropertyExpression
import org.codehaus.groovy.ast.stmt.EmptyStatement

/**
 * Relaxes static type checking for the dynamic parts of the Petriflow DSL.
 *
 * The action code is statically compiled against the stripped ActionDelegate so
 * that undefined DSL methods are caught. However, the DSL is dynamically typed:
 * field values (e.g. `field.value`) are `Object` and are indexed, iterated and
 * passed around freely. This extension allows method calls and property access
 * on anything that is NOT the ActionDelegate/ActionScript itself, so those
 * dynamic operations do not produce false-positive compile errors, while typos
 * in DSL method names are still reported.
 */
class DynamicTypeCheckingExtension extends TypeCheckingExtension {

    DynamicTypeCheckingExtension(StaticTypeCheckingVisitor typeCheckingVisitor) {
        super(typeCheckingVisitor)
    }

    @Override
    List<MethodNode> handleMissingMethod(ClassNode receiver, String name, ArgumentListExpression args,
                                         ClassNode[] argTypes, MethodCall call) {
        // Keep strict checking for the delegate (the DSL surface) and the action script itself.
        // An unknown name is always an error. A known DSL method is accepted only when an
        // overload matches the argument count and every mismatch comes from a dynamically typed
        // argument (`def` values from findTask/findCases/...); concrete mismatches stay errors.
        if (receiver.name in ["ActionScript", "ActionDelegate"]) {
            return acceptsDynamicArguments(receiver, name, argTypes) ? [dynamicMethod(name)] : []
        }
        // Any other receiver (Object, stub domain types, ...) is dynamic: allow the call.
        return [dynamicMethod(name)]
    }

    /** Whether a declared overload can accept this call when dynamic arguments act as wildcards. */
    private static boolean acceptsDynamicArguments(ClassNode receiver, String name, ClassNode[] argTypes) {
        def arguments = argTypes ?: new ClassNode[0]
        return declaredMethods(receiver, name).any { method -> acceptsArgumentTypes(method, arguments) }
    }

    /** Methods with this name declared on the type or one of its superclasses. */
    private static List<MethodNode> declaredMethods(ClassNode type, String name) {
        def methods = []
        def current = type
        while (current != null && current.name != "java.lang.Object") {
            methods.addAll(current.getMethods(name))
            current = current.getSuperClass()
        }
        return methods
    }

    /** True when the arity matches and every argument is dynamic or assignable to its parameter. */
    private static boolean acceptsArgumentTypes(MethodNode method, ClassNode[] argTypes) {
        def params = method.parameters
        // ACC_VARARGS from the JVM method access flags.
        boolean varArgs = params.length > 0 && (method.modifiers & 0x80) != 0
        int required = params.count { !it.hasInitialExpression() && !(varArgs && it == params.last()) }
        int maximum = varArgs ? Integer.MAX_VALUE : params.length
        if (argTypes.length < required || argTypes.length > maximum) {
            return false
        }
        for (int i = 0; i < argTypes.length; i++) {
            def parameterType = varArgs && i >= params.length - 1
                    ? params[params.length - 1].type.componentType
                    : params[i].type
            def argumentType = argTypes[i]
            if (!isDynamicArgument(argumentType) &&
                    !StaticTypeCheckingSupport.isAssignableTo(argumentType, parameterType)) {
                return false
            }
        }
        return true
    }

    /** Whether the argument type is dynamic (`def`, `Object`, or a generic placeholder). */
    private static boolean isDynamicArgument(ClassNode type) {
        return type == null || ClassHelper.isDynamicTyped(type) || ClassHelper.isObjectType(type) ||
                type.isGenericsPlaceHolder()
    }

    /** Synthetic method used to accept a call whose exact signature cannot be resolved. */
    private static MethodNode dynamicMethod(String name) {
        return new MethodNode(name, 1 /* ACC_PUBLIC */, ClassHelper.OBJECT_TYPE,
                new Parameter[0], new ClassNode[0], EmptyStatement.INSTANCE)
    }

    @Override
    void onMethodSelection(Expression expression, MethodNode target) {
        // Synthetic methods returned by handleMissingMethod have no declaring class.
        // Drop the direct-call target so code generation emits a dynamic dispatch
        // instead of a static call to the non-existent synthetic method.
        if (target != null && target.declaringClass == null) {
            expression.removeNodeMetaData(StaticTypesMarker.DIRECT_METHOD_CALL_TARGET)
        }
    }

    @Override
    boolean handleUnresolvedProperty(PropertyExpression pexp) {
        def objectType = getType(pexp.objectExpression)
        if (objectType.name in ["ActionScript", "ActionDelegate"]) {
            return false
        }
        storeType(pexp, ClassHelper.OBJECT_TYPE)
        // Mark the access as dynamically resolved so the class generator emits a
        // dynamic dispatch instead of rejecting the property ("Access to ... is
        // forbidden"). Without this, property reads on `def` parameters (common in
        // function bodies) fail at class-generation time even though the STC pass
        // accepted them.
        pexp.putNodeMetaData(StaticTypesMarker.DYNAMIC_RESOLUTION, Boolean.TRUE)
        return true
    }
}
