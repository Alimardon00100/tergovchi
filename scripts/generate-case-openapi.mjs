import { format, resolveConfig } from 'prettier';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../packages/shared/package.json', import.meta.url));
const s = require('@detective/shared'),
  { z } = require('zod');
const uuid = { type: 'string', format: 'uuid' },
  ref = (name) => ({ $ref: '#/components/schemas/' + name });
const definitions = {
  CasePreview: s.casePreviewSchema,
  CaseList: s.caseListSchema,
  Workspace: s.caseWorkspaceSchema,
  Meta: s.caseMetaSchema,
  Persons: s.personsSchema,
  Documents: s.documentsSchema,
  Draft: s.draftViewSchema,
  DraftSaved: s.draftSavedSchema,
  Score: s.scoreViewSchema,
  ScoreHistory: s.scoreHistorySchema,
  CreateCase: s.caseFileCreateSchema,
  CreatePerson: s.personCreateSchema,
  WriteDraft: s.draftWriteSchema,
  WriteReference: s.referenceWriteSchema,
  Submit: s.submitQualificationSchema,
  Reassign: s.reassignSchema,
  Resume: s.resumeSchema,
  UpdateUser: s.userRoleUpdateSchema,
  Users: s.adminUsersSchema,
  Audit: s.auditListSchema,
  Login: s.loginSchema,
};
const schemas = Object.fromEntries(
  Object.entries(definitions).map(([key, value]) => [
    key,
    z.toJSONSchema(value, { unrepresentable: 'any', io: 'input' }),
  ]),
);
for (const element of s.LEGAL_ELEMENTS) {
  schemas['Draft' + element] = z.toJSONSchema(s.draftSchemas[element], {
    unrepresentable: 'any',
    io: 'input',
  });
  schemas['Complete' + element] = z.toJSONSchema(s.completeSchemas[element], {
    unrepresentable: 'any',
    io: 'input',
  });
}
schemas.Error = {
  type: 'object',
  required: ['success', 'error', 'requestId'],
  properties: {
    success: { const: false },
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
    requestId: uuid,
  },
};
schemas.Reference = {
  type: 'object',
  required: ['revision', 'weights', 'answers'],
  properties: {
    revision: { type: 'integer', minimum: 0 },
    weights: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(s.ELEMENT_WEIGHTS).map(([k, v]) => [k, { const: v }]),
      ),
    },
    answers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['episodeId', 'elementType', 'payload'],
        properties: {
          episodeId: uuid,
          elementType: { enum: s.LEGAL_ELEMENTS },
          payload: { oneOf: s.LEGAL_ELEMENTS.map((el) => ref('Complete' + el)) },
        },
      },
    },
  },
};
schemas.TokenSession = {
  type: 'object',
  required: ['accessToken', 'tokenType', 'expiresIn', 'user'],
  properties: {
    accessToken: { type: 'string' },
    tokenType: { const: 'Bearer' },
    expiresIn: { const: 900 },
    user: z.toJSONSchema(s.publicUserSchema),
  },
};
const envelope = (data) => ({
  type: 'object',
  required: ['success', 'data', 'requestId'],
  properties: { success: { const: true }, data, requestId: uuid },
});
const paths = {},
  parameter = (name, schema, where = 'query', required = false) => ({
    name,
    in: where,
    required,
    schema,
  }),
  idParam = parameter('id', uuid, 'path', true),
  body = (name) => ({ required: true, content: { 'application/json': { schema: ref(name) } } });
function add(path, method, summary, response, options = {}) {
  const parameters = [];
  if (path.includes('{id}')) parameters.push(idParam);
  if (path.includes('{documentId}')) parameters.push(parameter('documentId', uuid, 'path', true));
  if (path.includes('{element}'))
    parameters.push(parameter('element', { enum: s.LEGAL_ELEMENTS }, 'path', true));
  parameters.push(...(options.parameters ?? []));
  const status = method === 'post' ? '201' : '200';
  const operation = {
    operationId: method + path.replace(/[^A-Za-z0-9]/g, ''),
    summary,
    tags: [
      path.startsWith('/admin')
        ? 'Administration'
        : path.startsWith('/auth')
          ? 'Authentication'
          : 'Cases',
    ],
    parameters,
    responses: {
      [status]: {
        description: 'Success',
        content: {
          'application/json': {
            schema: envelope(typeof response === 'string' ? ref(response) : response),
          },
        },
      },
      ...Object.fromEntries(
        [400, 401, 403, 404, 409, 422, 429, 500].map((code) => [
          String(code),
          {
            description: {
              400: 'Validation failed',
              401: 'Authentication required',
              403: 'Role, scope, or signed URL denied',
              404: 'Resource not found',
              409: 'Assignment, lock, version, state, or attempt conflict',
              422: 'Reference answers missing',
              429: 'Rate limit reached',
              500: 'Internal error',
            }[code],
            content: { 'application/json': { schema: ref('Error') } },
          },
        ]),
      ),
    },
    ...options,
  };
  paths[path] ??= {};
  paths[path][method] = operation;
}
add('/auth/login', 'post', 'Create session; access JWT expires in 15 minutes', 'TokenSession', {
  security: [],
  requestBody: body('Login'),
  description:
    'Sets HttpOnly strict-same-site access and rotating 7-day refresh cookies. Bearer API clients retain tergov_api_refresh at /api/v1/auth.',
});
add('/auth/refresh', 'post', 'Rotate refresh cookie and return a new access JWT', 'TokenSession', {
  security: [{ refreshCookie: [] }],
  description:
    'Refresh reuse revokes the token family. Versioned clients rotate their /api/v1/auth refresh cookie. Legacy browser clients use /api/auth/refresh.',
});
add('/auth/logout', 'post', 'Revoke JWT session family and clear cookies', {
  type: 'object',
  properties: { loggedOut: { const: true } },
});
add('/meta', 'get', 'Current role, department and visible investigator options', 'Meta');
add('/cases', 'get', 'Preview-only paginated case registry', 'CaseList', {
  parameters: [
    parameter('status', { enum: s.CASE_STATUSES }),
    parameter('jkArticle', { type: 'string', pattern: '^\\d{1,3}(-\\d{1,2})?$' }),
    parameter('from', { type: 'string', format: 'date' }),
    parameter('to', { type: 'string', format: 'date' }),
    parameter('investigatorId', uuid),
    parameter('page', { type: 'integer', minimum: 1, maximum: 10000, default: 1 }),
    parameter('pageSize', { type: 'integer', minimum: 1, maximum: 50, default: 6 }),
  ],
  description:
    'Filters are combined using AND. Date range applies to openedAt; to includes the entire UTC day. Preview has no documents, evidence, or persons.',
});
add('/cases', 'post', 'Admin creates a case with 1–10 episodes', 'CasePreview', {
  requestBody: body('CreateCase'),
});
add('/cases/{id}', 'get', 'General preview without evidence or documents', 'CasePreview');
add('/cases/{id}/workspace', 'get', 'Scoped process metadata and permissions', 'Workspace');
add(
  '/cases/{id}/lock',
  'post',
  'Investigator claims or renews the 24-hour case lock',
  'CasePreview',
  {
    description:
      'Case row SELECT FOR UPDATE serializes contenders. Existing assignment survives expiry or release; only department head can reassign.',
  },
);
add('/cases/{id}/lock', 'delete', 'Owner releases lock while retaining assignment', {
  type: 'object',
  properties: { released: { const: true } },
});
add('/cases/{id}/persons', 'get', 'Role-filtered persons; auditors receive masked PII', 'Persons');
add(
  '/cases/{id}/persons',
  'post',
  'Admin adds a person before assignment',
  { type: 'object', properties: { id: uuid } },
  { requestBody: body('CreatePerson') },
);
add(
  '/cases/{id}/documents',
  'get',
  'Document metadata with user-bound 15-minute signed links',
  'Documents',
);
add(
  '/cases/{id}/documents',
  'post',
  'Admin uploads a sanitized PDF or image while NEW',
  { type: 'object', properties: { id: uuid } },
  {
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: ['data', 'file'],
            properties: {
              data: {
                type: 'string',
                description: 'JSON: title (3..160), type (document enum), isEvidence (boolean)',
              },
              file: {
                type: 'string',
                format: 'binary',
                description:
                  'PDF, JPEG, PNG or WebP; 4 MiB maximum. PDFs max100 pages; encrypted/malformed PDFs rejected.',
              },
            },
          },
        },
      },
    },
  },
);
add(
  '/cases/{id}/documents/{documentId}/file',
  'get',
  'Open protected document; starts investigator workflow',
  { type: 'string', format: 'binary' },
  {
    parameters: [parameter('token', { type: 'string', maxLength: 1500 }, 'query', true)],
    description:
      'Signed URL alone is insufficient: authenticate as its intended user. Assignment and scope are rechecked. Active investigators need their lock. Opening the first document changes ASSIGNED to IN_INVESTIGATION.',
  },
);
paths['/cases/{id}/documents/{documentId}/file'].get.responses['200'] = {
  description: 'Private no-store document; binary, no envelope',
  content: {
    'application/pdf': { schema: { type: 'string', format: 'binary' } },
    'image/webp': { schema: { type: 'string', format: 'binary' } },
  },
};
add(
  '/cases/{id}/qualification',
  'get',
  'Investigator draft or supervisory read-only answers',
  'Draft',
  {
    description:
      'ADMIN and AUDITOR denied. HEAD restricted to department; PROSECUTOR reads all. No reference keys included.',
  },
);
add(
  '/cases/{id}/qualification/answers/{element}',
  'put',
  'Autosave a single episode element using audited last-write-wins',
  'DraftSaved',
  {
    requestBody: body('WriteDraft'),
    description:
      'Payload must match Draft{element} schema. baseVersion starts at 0. Conflict returns conflict=true and saves the latest submitted value. Missing/foreign persons and episodes are rejected. First actual document must already be open. A new draft after scoring starts the next attempt; it is counted only on submit.',
    'x-payload-schemas': Object.fromEntries(s.LEGAL_ELEMENTS.map((el) => [el, ref('Draft' + el)])),
  },
);
add(
  '/cases/{id}/qualification/submit',
  'post',
  'Validate all episodes and atomically score attempt 1–3',
  'Score',
  {
    requestBody: body('Submit'),
    description:
      'All five complete payloads required per episode. No reference →422. Global case limit3, final score=best; reassign does not reset it. Subject50; other four12.5 independently. Objective3 equally weighted subfields; subjective4 for intentional reference, otherwise3. F1 uses deduplicated sets, empty/empty=1. Notes are not graded. Multi-episode weighted mean; round only final total to2 decimals.',
  },
);
add(
  '/cases/{id}/score',
  'get',
  'Score history; investigator sees own attempts only',
  'ScoreHistory',
);
for (const [name, summary, request] of [
  ['approve', 'Department head approves SCORED → CLOSED', null],
  ['reassign', 'Department head reassigns to an active department investigator', 'Reassign'],
  ['suspend', 'Department head suspends the case', 'Suspend'],
  ['resume', 'Department head resumes a suspended case with a future deadline', 'Resume'],
]) {
  if (name === 'suspend')
    schemas.Suspend = {
      type: 'object',
      required: ['reason'],
      properties: { reason: { type: 'string', minLength: 5, maxLength: 1000 } },
      additionalProperties: false,
    };
  add(
    '/cases/{id}/' + name,
    'post',
    summary,
    'CasePreview',
    request ? { requestBody: body(request) } : {},
  );
}
add(
  '/cases/{id}/export',
  'get',
  'Download role-filtered report; no reference payloads',
  { type: 'string', format: 'binary' },
  { parameters: [parameter('format', { enum: ['pdf', 'docx'] }, 'query', true)] },
);
paths['/cases/{id}/export'].get.responses['200'] = {
  description: 'Attachment; private,no-store; no JSON envelope',
  content: {
    'application/pdf': { schema: { type: 'string', format: 'binary' } },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      schema: { type: 'string', format: 'binary' },
    },
  },
};
add(
  '/admin/cases/{id}/reference-answers',
  'get',
  'Admin-only complete answer keys and fixed weights',
  'Reference',
);
add(
  '/admin/cases/{id}/reference-answers',
  'put',
  'Admin replaces all episode keys using revision check',
  { type: 'object', properties: { revision: { type: 'integer', minimum: 1 } } },
  {
    requestBody: body('WriteReference'),
    description:
      'Exactly one answer per episode×five elements. All complete schemas apply. Fixed weights cannot be changed via payload. Revision mismatch409. Each score privately snapshots the reference revision; public results never contain these keys. Closed case keys are immutable.',
  },
);
add('/admin/users', 'get', 'Admin paginated role management', 'Users', {
  parameters: [parameter('page', { type: 'integer', minimum: 1, maximum: 10000, default: 1 })],
});
add(
  '/admin/users/{id}',
  'patch',
  'Admin changes role/department/ban and revokes sessions',
  { type: 'object', properties: { updated: { const: true } } },
  {
    requestBody: body('UpdateUser'),
    description:
      'Cannot remove own admin access or ban self. Last active admin is protected. Existing case assignment remains for head reassignment.',
  },
);
add(
  '/audit',
  'get',
  'Admin or auditor reads process audit; no answer payloads or plaintext PII',
  'Audit',
  { parameters: [parameter('page', { type: 'integer', minimum: 1, maximum: 10000, default: 1 })] },
);
const document = {
  openapi: '3.1.0',
  info: {
    title: 'Tergovchi — Jinoyat ishi v2',
    version: '2.0.0',
    description:
      'Working local prototype. USER=investigator; HEAD=department head. JPK procedural records and JK qualification are separate aggregates. Legacy game /api endpoints stay intact.',
  },
  servers: [{ url: '/api/v1' }],
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  tags: [{ name: 'Authentication' }, { name: 'Cases' }, { name: 'Administration' }],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'tergov_access' },
      refreshCookie: { type: 'apiKey', in: 'cookie', name: 'tergov_api_refresh' },
    },
    schemas,
  },
};
await mkdir('docs/case-module', { recursive: true });
await writeFile(
  'docs/case-module/openapi.json',
  await format(JSON.stringify(document), {
    ...(await resolveConfig('docs/case-module/openapi.json')),
    parser: 'json',
  }),
);
process.stdout.write(
  `OpenAPI 3.1 generated: ${Object.keys(paths).length} paths, ${Object.keys(schemas).length} schemas.\n`,
);
