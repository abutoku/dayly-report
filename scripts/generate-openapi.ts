/**
 * OpenAPI 仕様書を Zod スキーマから生成するスクリプト
 *
 * 使い方: npm run openapi:gen
 */
import * as fs from "node:fs";
import * as path from "node:path";

import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";

import {
  LoginRequestSchema,
  LoginResponseDataSchema,
} from "../src/schemas/auth";
import {
  CreateCommentRequestSchema,
  CommentResponseSchema,
} from "../src/schemas/comment";
import {
  ErrorResponseSchema,
  paginatedSchema,
  successSchema,
} from "../src/schemas/common";
import {
  CreateCustomerRequestSchema,
  UpdateCustomerRequestSchema,
  CustomerListItemSchema,
  CustomerDetailSchema,
  CustomerListQuerySchema,
} from "../src/schemas/customer";
import {
  CreateReportRequestSchema,
  UpdateReportRequestSchema,
  ReportListItemSchema,
  ReportListQuerySchema,
  ReportDetailSchema,
  ReportMutationResponseSchema,
} from "../src/schemas/report";
import {
  CreateSalespersonRequestSchema,
  UpdateSalespersonRequestSchema,
  SalespersonListItemSchema,
  SalespersonDetailSchema,
  SalespersonListQuerySchema,
} from "../src/schemas/salesperson";

const registry = new OpenAPIRegistry();

// ---------------------------------------------------------------------------
// 共通エラーレスポンス定義
// ---------------------------------------------------------------------------
const errorContent = {
  "application/json": { schema: ErrorResponseSchema },
};

const unauthorizedResponse = {
  description: "未認証",
  content: errorContent,
};

const forbiddenResponse = {
  description: "権限不足",
  content: errorContent,
};

const notFoundResponse = {
  description: "リソースが見つからない",
  content: errorContent,
};

const validationErrorResponse = {
  description: "バリデーションエラー",
  content: errorContent,
};

// ---------------------------------------------------------------------------
// Bearer 認証
// ---------------------------------------------------------------------------
registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

// ---------------------------------------------------------------------------
// 1. 認証
// ---------------------------------------------------------------------------

// POST /auth/login
registry.registerPath({
  method: "post",
  path: "/api/v1/auth/login",
  summary: "ログイン",
  tags: ["認証"],
  request: {
    body: {
      content: { "application/json": { schema: LoginRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "認証成功",
      content: {
        "application/json": {
          schema: successSchema(LoginResponseDataSchema),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

// POST /auth/logout
registry.registerPath({
  method: "post",
  path: "/api/v1/auth/logout",
  summary: "ログアウト",
  tags: ["認証"],
  security: [{ BearerAuth: [] }],
  request: {},
  responses: {
    204: { description: "ログアウト成功" },
    401: unauthorizedResponse,
  },
});

// ---------------------------------------------------------------------------
// 2. 日報
// ---------------------------------------------------------------------------

// GET /reports
registry.registerPath({
  method: "get",
  path: "/api/v1/reports",
  summary: "日報一覧取得",
  tags: ["日報"],
  security: [{ BearerAuth: [] }],
  request: {
    query: ReportListQuerySchema,
  },
  responses: {
    200: {
      description: "日報一覧",
      content: {
        "application/json": {
          schema: paginatedSchema(ReportListItemSchema),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

// POST /reports
registry.registerPath({
  method: "post",
  path: "/api/v1/reports",
  summary: "日報作成",
  tags: ["日報"],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: CreateReportRequestSchema },
      },
    },
  },
  responses: {
    201: {
      description: "日報作成成功",
      content: {
        "application/json": {
          schema: successSchema(ReportMutationResponseSchema),
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    409: {
      description: "同一日付の日報が既に存在",
      content: errorContent,
    },
  },
});

// GET /reports/:id
registry.registerPath({
  method: "get",
  path: "/api/v1/reports/{id}",
  summary: "日報詳細取得",
  tags: ["日報"],
  security: [{ BearerAuth: [] }],
  request: {
    params: ReportDetailSchema.pick({ id: true }),
  },
  responses: {
    200: {
      description: "日報詳細",
      content: {
        "application/json": {
          schema: successSchema(ReportDetailSchema),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

// PUT /reports/:id
registry.registerPath({
  method: "put",
  path: "/api/v1/reports/{id}",
  summary: "日報更新",
  tags: ["日報"],
  security: [{ BearerAuth: [] }],
  request: {
    params: ReportDetailSchema.pick({ id: true }),
    body: {
      content: {
        "application/json": { schema: UpdateReportRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: "日報更新成功",
      content: {
        "application/json": {
          schema: successSchema(ReportMutationResponseSchema),
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

// DELETE /reports/:id
registry.registerPath({
  method: "delete",
  path: "/api/v1/reports/{id}",
  summary: "日報削除",
  tags: ["日報"],
  security: [{ BearerAuth: [] }],
  request: {
    params: ReportDetailSchema.pick({ id: true }),
  },
  responses: {
    204: { description: "日報削除成功" },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

// POST /reports/:id/comments
registry.registerPath({
  method: "post",
  path: "/api/v1/reports/{id}/comments",
  summary: "コメント投稿",
  tags: ["日報"],
  security: [{ BearerAuth: [] }],
  request: {
    params: ReportDetailSchema.pick({ id: true }),
    body: {
      content: {
        "application/json": { schema: CreateCommentRequestSchema },
      },
    },
  },
  responses: {
    201: {
      description: "コメント投稿成功",
      content: {
        "application/json": {
          schema: successSchema(CommentResponseSchema),
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

// ---------------------------------------------------------------------------
// 3. 顧客マスタ
// ---------------------------------------------------------------------------

// GET /customers
registry.registerPath({
  method: "get",
  path: "/api/v1/customers",
  summary: "顧客一覧取得",
  tags: ["顧客マスタ"],
  security: [{ BearerAuth: [] }],
  request: {
    query: CustomerListQuerySchema,
  },
  responses: {
    200: {
      description: "顧客一覧",
      content: {
        "application/json": {
          schema: paginatedSchema(CustomerListItemSchema),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

// POST /customers
registry.registerPath({
  method: "post",
  path: "/api/v1/customers",
  summary: "顧客登録",
  tags: ["顧客マスタ"],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: CreateCustomerRequestSchema },
      },
    },
  },
  responses: {
    201: {
      description: "顧客登録成功",
      content: {
        "application/json": {
          schema: successSchema(CustomerDetailSchema),
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
  },
});

// GET /customers/:id
registry.registerPath({
  method: "get",
  path: "/api/v1/customers/{id}",
  summary: "顧客詳細取得",
  tags: ["顧客マスタ"],
  security: [{ BearerAuth: [] }],
  request: {
    params: CustomerDetailSchema.pick({ id: true }),
  },
  responses: {
    200: {
      description: "顧客詳細",
      content: {
        "application/json": {
          schema: successSchema(CustomerDetailSchema),
        },
      },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
});

// PUT /customers/:id
registry.registerPath({
  method: "put",
  path: "/api/v1/customers/{id}",
  summary: "顧客更新",
  tags: ["顧客マスタ"],
  security: [{ BearerAuth: [] }],
  request: {
    params: CustomerDetailSchema.pick({ id: true }),
    body: {
      content: {
        "application/json": { schema: UpdateCustomerRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: "顧客更新成功",
      content: {
        "application/json": {
          schema: successSchema(CustomerDetailSchema),
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
});

// ---------------------------------------------------------------------------
// 4. 営業マスタ
// ---------------------------------------------------------------------------

// GET /salespersons
registry.registerPath({
  method: "get",
  path: "/api/v1/salespersons",
  summary: "営業一覧取得",
  tags: ["営業マスタ"],
  security: [{ BearerAuth: [] }],
  request: {
    query: SalespersonListQuerySchema,
  },
  responses: {
    200: {
      description: "営業一覧",
      content: {
        "application/json": {
          schema: paginatedSchema(SalespersonListItemSchema),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

// POST /salespersons
registry.registerPath({
  method: "post",
  path: "/api/v1/salespersons",
  summary: "営業登録",
  tags: ["営業マスタ"],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: CreateSalespersonRequestSchema },
      },
    },
  },
  responses: {
    201: {
      description: "営業登録成功",
      content: {
        "application/json": {
          schema: successSchema(SalespersonDetailSchema),
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: {
      description: "メールアドレスが重複",
      content: errorContent,
    },
  },
});

// GET /salespersons/:id
registry.registerPath({
  method: "get",
  path: "/api/v1/salespersons/{id}",
  summary: "営業詳細取得",
  tags: ["営業マスタ"],
  security: [{ BearerAuth: [] }],
  request: {
    params: SalespersonDetailSchema.pick({ id: true }),
  },
  responses: {
    200: {
      description: "営業詳細",
      content: {
        "application/json": {
          schema: successSchema(SalespersonDetailSchema),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

// PUT /salespersons/:id
registry.registerPath({
  method: "put",
  path: "/api/v1/salespersons/{id}",
  summary: "営業更新",
  tags: ["営業マスタ"],
  security: [{ BearerAuth: [] }],
  request: {
    params: SalespersonDetailSchema.pick({ id: true }),
    body: {
      content: {
        "application/json": { schema: UpdateSalespersonRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: "営業更新成功",
      content: {
        "application/json": {
          schema: successSchema(SalespersonDetailSchema),
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: {
      description: "メールアドレスが重複",
      content: errorContent,
    },
  },
});

// ---------------------------------------------------------------------------
// ドキュメント生成
// ---------------------------------------------------------------------------
const generator = new OpenApiGeneratorV31(registry.definitions);
const doc = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "営業日報システム API",
    version: "1.0.0",
    description: "営業日報システムの REST API 仕様",
  },
  servers: [{ url: "http://localhost:3000", description: "開発環境" }],
});

const yaml = jsonToYaml(doc);
const outPath = path.resolve(__dirname, "..", "openapi.yaml");
fs.writeFileSync(outPath, yaml, "utf-8");
console.log(`OpenAPI spec generated: ${outPath}`);

// ---------------------------------------------------------------------------
// 簡易 JSON → YAML 変換
// ---------------------------------------------------------------------------
function jsonToYaml(obj: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (typeof obj === "number") return String(obj);
  if (typeof obj === "string") {
    if (
      obj.includes("\n") ||
      obj.includes(":") ||
      obj.includes("#") ||
      obj.includes("'") ||
      obj.includes('"') ||
      obj.startsWith("{") ||
      obj.startsWith("[") ||
      obj === "true" ||
      obj === "false" ||
      obj === "null" ||
      /^\d/.test(obj)
    ) {
      // Use double-quoted scalar with escaping
      return `"${obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj
      .map((item) => {
        const val = jsonToYaml(item, indent + 1);
        if (typeof item === "object" && item !== null) {
          // First key goes on the same line as the dash
          const lines = val.split("\n");
          return `${pad}- ${lines[0].trimStart()}\n${lines.slice(1).join("\n")}`;
        }
        return `${pad}- ${val}`;
      })
      .join("\n");
  }

  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries
      .map(([key, value]) => {
        if (
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          Object.keys(value as Record<string, unknown>).length > 0
        ) {
          return `${pad}${key}:\n${jsonToYaml(value, indent + 1)}`;
        }
        if (Array.isArray(value) && value.length > 0) {
          return `${pad}${key}:\n${jsonToYaml(value, indent + 1)}`;
        }
        return `${pad}${key}: ${jsonToYaml(value, indent + 1)}`;
      })
      .join("\n");
  }

  return String(obj);
}
