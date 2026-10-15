// @ts-check
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import unicorn from "eslint-plugin-unicorn";
import noBarrelFiles from "eslint-plugin-no-barrel-files";
import functional from "eslint-plugin-functional";

// eslint-config-next 15 ships eslintrc configs only, so the Next rules come in through
// FlatCompat. The flat exports (`eslint-config-next/core-web-vitals`) start with Next 16.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const enumMemberPattern = /^[A-Z][a-zA-Z0-9]*$/;

const unwrapTypeScriptExpression = (node) => {
  if (node?.type === "TSAsExpression" || node?.type === "TSSatisfiesExpression") {
    return unwrapTypeScriptExpression(node.expression);
  }

  return node;
};

const unwrapTypeAnnotation = (node) =>
  node?.type === "TSParenthesizedType" ? unwrapTypeAnnotation(node.typeAnnotation) : node;

const getPropertyKeyName = (property) => {
  if (property.type !== "Property" || property.computed || property.kind !== "init") {
    return null;
  }

  if (property.key.type === "Identifier") {
    return property.key.name;
  }

  return property.key.type === "Literal" && typeof property.key.value === "string"
    ? property.key.value
    : null;
};

const isStringLiteralNode = (node) => node.type === "Literal" && typeof node.value === "string";

const isStringLiteralTypeNode = (node) =>
  node.type === "TSLiteralType" && isStringLiteralNode(node.literal);

const isStringUnionTypeNode = (node) => {
  const normalizedNode = unwrapTypeAnnotation(node);

  return (
    normalizedNode?.type === "TSUnionType" &&
    normalizedNode.types.length > 1 &&
    normalizedNode.types.every((typeNode) => isStringLiteralTypeNode(typeNode))
  );
};

const isPseudoEnumObjectExpression = (node) => {
  const normalizedNode = unwrapTypeScriptExpression(node);

  return (
    normalizedNode?.type === "ObjectExpression" &&
    normalizedNode.properties.length > 1 &&
    normalizedNode.properties.every((property) => {
      const keyName = getPropertyKeyName(property);

      return (
        keyName !== null && isStringLiteralNode(property.value) && property.value.value === keyName
      );
    })
  );
};

const reexportGuard = {
  rules: {
    "no-reexports": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          namedReexport:
            "Re-exports are forbidden, import directly from the source file instead of re-exporting.",
          wildcardReexport:
            "Wildcard re-exports are forbidden, import directly from the source file instead of re-exporting.",
        },
      },
      create(context) {
        return {
          ExportNamedDeclaration(node) {
            if (node.source !== null) {
              context.report({ node, messageId: "namedReexport" });
            }
          },
          ExportAllDeclaration(node) {
            context.report({ node, messageId: "wildcardReexport" });
          },
        };
      },
    },
  },
};

const enumGuard = {
  rules: {
    "prefer-enum": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          pseudoEnum: "Use an enum instead of a const object pseudo-enum.",
          stringUnion: "Use an enum instead of a direct string-literal union type.",
        },
      },
      create(context) {
        return {
          TSTypeAliasDeclaration(node) {
            if (!isStringUnionTypeNode(node.typeAnnotation)) {
              return;
            }

            context.report({ node: node.id, messageId: "stringUnion" });
          },
          VariableDeclarator(node) {
            if (node.init === null || !isPseudoEnumObjectExpression(node.init)) {
              return;
            }

            context.report({ node: node.id, messageId: "pseudoEnum" });
          },
        };
      },
    },
    "enum-style": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          explicitInitializer: "Enum members must use explicit key = value initializers.",
          keyValueMatch: "Enum member key and value must match exactly.",
          stringInitializer: "Enum member initializers must be string literals.",
          validCase: "Enum member keys and values must be PascalCase.",
        },
      },
      create(context) {
        return {
          TSEnumMember(node) {
            const memberName =
              node.id.type === "Identifier"
                ? node.id.name
                : node.id.type === "Literal" && typeof node.id.value === "string"
                  ? node.id.value
                  : null;

            if (memberName === null || !enumMemberPattern.test(memberName)) {
              context.report({ node: node.id, messageId: "validCase" });
            }

            if (node.initializer === undefined) {
              context.report({ node, messageId: "explicitInitializer" });

              return;
            }

            if (!isStringLiteralNode(node.initializer)) {
              context.report({ node: node.initializer, messageId: "stringInitializer" });

              return;
            }

            if (!enumMemberPattern.test(node.initializer.value)) {
              context.report({ node: node.initializer, messageId: "validCase" });
            }

            if (memberName !== null && node.initializer.value !== memberName) {
              context.report({ node: node.initializer, messageId: "keyValueMatch" });
            }
          },
        };
      },
    },
  },
};

const castGuard = {
  rules: {
    "no-double-assertion-through-unknown": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          doubleAssertion:
            "Double assertions through unknown are forbidden. Model the boundary with an explicit type instead.",
        },
      },
      create(context) {
        const reportIfUnknownAssertion = (node, expression) => {
          if (
            expression !== undefined &&
            (expression.type === "TSAsExpression" || expression.type === "TSTypeAssertion") &&
            expression.typeAnnotation.type === "TSUnknownKeyword"
          ) {
            context.report({ node, messageId: "doubleAssertion" });
          }
        };

        return {
          TSAsExpression(node) {
            reportIfUnknownAssertion(node, node.expression);
          },
          TSTypeAssertion(node) {
            reportIfUnknownAssertion(node, node.expression);
          },
        };
      },
    },
  },
};

const importGuard = {
  rules: {
    "no-inline-imports": {
      meta: {
        type: "problem",
        schema: [
          {
            type: "object",
            properties: {
              allowDynamicImport: { type: "boolean" },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          dynamicImport:
            "Dynamic import() is forbidden. Imports belong at the top of the file as static `import` statements. Lazy/runtime imports are only permitted in narrow framework seams (Next.js instrumentation) and tests, where this rule is explicitly relaxed in eslint.config.mjs.",
          importType:
            'The import("...") type expression and typeof import("...") are forbidden. Add a top-level `import type { ... } from "..."` instead.',
        },
      },
      create(context) {
        const options = context.options[0] ?? {};
        const allowDynamicImport = options.allowDynamicImport === true;

        return {
          ImportExpression(node) {
            if (allowDynamicImport) {
              return;
            }

            context.report({ node, messageId: "dynamicImport" });
          },
          TSImportType(node) {
            context.report({ node, messageId: "importType" });
          },
        };
      },
    },
  },
};

export default defineConfig(
  eslint.configs.recommended,

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  ...tseslint.configs.recommendedTypeChecked,

  ...(Array.isArray(noBarrelFiles.flat) ? noBarrelFiles.flat : [noBarrelFiles.flat]),

  globalIgnores([
    ".next/**",
    "coverage/**",
    "out/**",
    "build/**",
    ".data/**",
    ".claude-tmp/**",
    "next-env.d.ts",
  ]),

  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      unicorn,
      functional,
      enumGuard,
      reexportGuard,
      castGuard,
      importGuard,
    },
    rules: {
      "enumGuard/prefer-enum": "error",
      "enumGuard/enum-style": "error",
      "reexportGuard/no-reexports": "error",
      "importGuard/no-inline-imports": "error",
      "castGuard/no-double-assertion-through-unknown": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "no-param-reassign": "error",
      "functional/immutable-data": [
        "error",
        {
          ignoreClasses: true,
          ignoreImmediateMutation: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "explicit",
          overrides: {
            accessors: "explicit",
            constructors: "no-public",
            methods: "explicit",
            properties: "explicit",
            parameterProperties: "explicit",
          },
        },
      ],
      "unicorn/filename-case": [
        "error",
        {
          cases: {
            camelCase: true,
            pascalCase: true,
          },
        },
      ],
      "@typescript-eslint/parameter-properties": [
        "error",
        {
          prefer: "parameter-property",
        },
      ],
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Program > ExpressionStatement[directive='use server'] ~ ExportDefaultDeclaration",
          message: 'Top-level "use server" modules must only export named async functions.',
        },
        {
          selector:
            "Program > ExpressionStatement[directive='use server'] ~ ExportNamedDeclaration[declaration.type!='FunctionDeclaration']",
          message: 'Top-level "use server" modules must only export named async functions.',
        },
        {
          selector:
            "Program > ExpressionStatement[directive='use server'] ~ ExportNamedDeclaration > FunctionDeclaration[async!=true]",
          message: 'Top-level "use server" modules must only export named async functions.',
        },
        {
          selector: "TSAsExpression > TSAnyKeyword",
          message:
            "Type assertions to any are forbidden. Replace the assertion with a precise type.",
        },
        {
          selector: "TSTypeAssertion > TSAnyKeyword",
          message:
            "Type assertions to any are forbidden. Replace the assertion with a precise type.",
        },
        {
          selector: "TSAsExpression[typeAnnotation.type='TSNeverKeyword']",
          message:
            "Assertions to never are forbidden. Model the transaction or boundary with a precise type instead.",
        },
        {
          selector: "TSTypeAssertion[typeAnnotation.type='TSNeverKeyword']",
          message:
            "Assertions to never are forbidden. Model the transaction or boundary with a precise type instead.",
        },
      ],
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "block-like", next: "*" },
        { blankLine: "always", prev: "*", next: "return" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": true,
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },

  // Dynamic import() is forbidden everywhere by importGuard/no-inline-imports. These are
  // the only places a runtime import is legitimate, so the rule is relaxed to allow
  // ImportExpression here while still banning the import("...") type syntax:
  //   - Next.js instrumentation: gates node-only deps out of the edge bundle.
  //   - tests: vi.resetModules() + await import() is the only fresh-module idiom.
  // Any new exception must be added here deliberately and reviewed in the diff.
  {
    files: ["src/instrumentation.ts", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "importGuard/no-inline-imports": ["error", { allowDynamicImport: true }],
    },
  },

  // React refs are mutable by design (`ref.current` is React's escape hatch for values
  // that must not re-render), and DOM properties such as document.title or an element's
  // style only change by assignment. Component files may therefore assign to exactly
  // these accessors; everything else stays strictly immutable.
  {
    files: ["**/*.tsx"],
    rules: {
      "functional/immutable-data": [
        "error",
        {
          ignoreClasses: true,
          ignoreImmediateMutation: true,
          ignoreAccessorPattern: ["**.current", "document.title", "**.style.*"],
        },
      ],
    },
  },

  // Enforce @/ import aliases, no deep relative imports.
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../*", "../../../*", "../../../../*"],
              message: "Use @/ import aliases instead of deep relative imports",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },

  prettierConfig,
);
