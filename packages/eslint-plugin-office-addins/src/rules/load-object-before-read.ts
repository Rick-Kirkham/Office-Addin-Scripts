import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import { Reference, Scope, Variable } from "@typescript-eslint/scope-manager";
import { isLoadCall, parsePropertiesArgument } from "../utils/load";
import { findCallExpression, findPropertiesRead } from "../utils/utils";
import { isGetFunction, isGetOrNullObjectFunction } from "../utils/getFunction";

export default ESLintUtils.RuleCreator(
  () =>
    "https://docs.microsoft.com/office/dev/add-ins/develop/application-specific-api-model#load",
)({
  name: "load-object-before-read",
  meta: {
    type: "problem",
    messages: {
      loadBeforeRead:
        "An explicit load call on '{{name}}' for property '{{loadValue}}' needs to be made before the property can be read.",
    },
    docs: {
      description:
        "Before you can read the properties of a proxy object, you must explicitly load the properties.",
    },
    schema: [],
  },
  create: function (context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    function isInsideWriteStatement(node: TSESTree.Node): boolean {
      while (node.parent) {
        node = node.parent;
        if (node.type === TSESTree.AST_NODE_TYPES.AssignmentExpression)
          return true;
      }
      return false;
    }

    function hasBeenLoaded(
      node: TSESTree.Node,
      loadLocation: Map<string, number>,
      propertyName: string,
    ): boolean {
      return (
        loadLocation.has(propertyName) && // If reference came after load, return
        node.range[1] > (loadLocation.get(propertyName) ?? 0)
      );
    }

    function findLoadBeforeRead(scope: Scope) {
      scope.variables.forEach((variable: Variable) => {
        const loadLocation: Map<string, number> = new Map<string, number>();
        let getFound: boolean = false;

        variable.references.forEach((reference: Reference) => {
          const node: TSESTree.Node = reference.identifier;
          const parent = node.parent;

          if (parent?.type === TSESTree.AST_NODE_TYPES.VariableDeclarator) {
            getFound = false; // In case of reassignment

            if (
              parent.init &&
              isGetFunction(parent.init) &&
              !isGetOrNullObjectFunction(parent.init)
            ) {
              getFound = true;
              return;
            }
          }

          if (parent?.type === TSESTree.AST_NODE_TYPES.AssignmentExpression) {
            getFound = false; // In case of reassignment

            if (
              isGetFunction(parent.right) &&
              !isGetOrNullObjectFunction(parent.right)
            ) {
              getFound = true;
              return;
            }
          }

          if (!getFound) {
            // If reference was not related to a previous get
            return;
          }

          // Look for <obj>.load(...) call
          if (parent?.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
            const methodCall = findCallExpression(parent);

            if (methodCall && isLoadCall(methodCall)) {
              const argument = methodCall.arguments[0];
              const propertyNames: string[] = argument
                ? parsePropertiesArgument(argument)
                : ["*"];
              propertyNames.forEach((propertyName: string) => {
                loadLocation.set(propertyName, node.range[1]);
              });
              return;
            }
          }

          // Look for context.load(<obj>, "...") call
          if (parent?.type === TSESTree.AST_NODE_TYPES.CallExpression) {
            const args: TSESTree.CallExpressionArgument[] = parent?.arguments;
            if (isLoadCall(parent) && args[0] == node && args.length < 3) {
              const propertyNames: string[] = args[1]
                ? parsePropertiesArgument(args[1])
                : ["*"];
              propertyNames.forEach((propertyName: string) => {
                loadLocation.set(propertyName, node.range[1]);
              });
              return;
            }
          }

          const propertyName: string = findPropertiesRead(parent);

          if (
            !propertyName ||
            hasBeenLoaded(node, loadLocation, propertyName) ||
            hasBeenLoaded(node, loadLocation, "*") ||
            isInsideWriteStatement(node)
          ) {
            return;
          }

          context.report({
            node: node,
            messageId: "loadBeforeRead",
            data: { name: node.name, loadValue: propertyName },
          });
        });
      });
      scope.childScopes.forEach(findLoadBeforeRead);
    }

    return {
      Program(node) {
        const scope = sourceCode.getScope
          ? sourceCode.getScope(node)
          : context.getScope();
        findLoadBeforeRead(scope);
      },
    };
  },
  defaultOptions: [],
});
