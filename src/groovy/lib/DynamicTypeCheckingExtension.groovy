import org.codehaus.groovy.transform.stc.TypeCheckingExtension
import org.codehaus.groovy.transform.stc.StaticTypeCheckingVisitor
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
        if (receiver.name in ["ActionScript", "ActionDelegate"]) {
            return []
        }
        // Any other receiver (Object, stub domain types, ...) is dynamic: allow the call.
        def method = new MethodNode(name, 1 /* ACC_PUBLIC */, ClassHelper.OBJECT_TYPE,
                new Parameter[0], new ClassNode[0], EmptyStatement.INSTANCE)
        return [method]
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
        return true
    }
}
