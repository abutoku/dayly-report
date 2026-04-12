import "./setup";

export {
  PaginationSchema,
  PaginationQuerySchema,
  ErrorDetailSchema,
  ErrorBodySchema,
  ErrorResponseSchema,
  successSchema,
  paginatedSchema,
} from "./common";

export {
  LoginRequestSchema,
  LoginSalespersonSchema,
  LoginResponseDataSchema,
} from "./auth";

export {
  VisitRequestSchema,
  VisitResponseSchema,
  ReportStatusSchema,
  CreateReportRequestSchema,
  UpdateReportRequestSchema,
  ReportListItemSchema,
  ReportListQuerySchema,
  ReportDetailSchema,
  ReportMutationResponseSchema,
} from "./report";

export {
  CreateCustomerRequestSchema,
  UpdateCustomerRequestSchema,
  CustomerListQuerySchema,
  CustomerListItemSchema,
  CustomerDetailSchema,
} from "./customer";

export {
  CreateSalespersonRequestSchema,
  UpdateSalespersonRequestSchema,
  SalespersonListQuerySchema,
  SalespersonListItemSchema,
  SalespersonDetailSchema,
} from "./salesperson";

export { CreateCommentRequestSchema, CommentResponseSchema } from "./comment";
