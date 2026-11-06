// Minimal Zod (v3) -> JSON Schema converter for the OpenAPI document. Written in-house so the locked
// stack gets no new dependency. It covers what the route schemas in this repo use; anything it does
// not recognise degrades to `{}` (any) rather than throwing, so one odd schema never breaks the spec.

const unwrap = (s) => s?._def?.innerType ?? s?._def?.schema ?? s?._def?.in;

export function toJsonSchema(s) {
  const d = s?._def;
  if (!d) return {};
  switch (d.typeName) {
    case 'ZodString': {
      const out = { type: 'string' };
      for (const c of d.checks ?? []) {
        if (c.kind === 'min') out.minLength = c.value;
        else if (c.kind === 'max') out.maxLength = c.value;
        else if (c.kind === 'email') out.format = 'email';
        else if (c.kind === 'url') out.format = 'uri';
        else if (c.kind === 'uuid') out.format = 'uuid';
        else if (c.kind === 'datetime') out.format = 'date-time';
      }
      return out;
    }
    case 'ZodNumber': {
      const out = { type: (d.checks ?? []).some((c) => c.kind === 'int') ? 'integer' : 'number' };
      for (const c of d.checks ?? []) {
        if (c.kind === 'min') out.minimum = c.value;
        else if (c.kind === 'max') out.maximum = c.value;
      }
      return out;
    }
    case 'ZodBigInt':
      return { type: 'integer' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodDate':
      return { type: 'string', format: 'date-time' };
    case 'ZodLiteral':
      return { enum: [d.value] };
    case 'ZodEnum':
      return { type: 'string', enum: [...d.values] };
    case 'ZodNativeEnum':
      return {
        enum: Object.values(d.values).filter((v) => typeof v !== 'number' || !(v in d.values) || true),
      };
    case 'ZodArray':
      return { type: 'array', items: toJsonSchema(d.type) };
    case 'ZodObject': {
      const shape = d.shape();
      const properties = {};
      const required = [];
      for (const [k, v] of Object.entries(shape)) {
        properties[k] = toJsonSchema(v);
        if (!v.isOptional()) required.push(k);
      }
      return { type: 'object', properties, ...(required.length ? { required } : {}) };
    }
    case 'ZodRecord':
      return { type: 'object', additionalProperties: toJsonSchema(d.valueType) };
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion':
      return { anyOf: [...(d.options?.values?.() ?? d.options)].map(toJsonSchema) };
    case 'ZodIntersection':
      return { allOf: [toJsonSchema(d.left), toJsonSchema(d.right)] };
    case 'ZodNullable':
      return { ...toJsonSchema(d.innerType), nullable: true };
    case 'ZodDefault':
      return { ...toJsonSchema(d.innerType), default: d.defaultValue() };
    case 'ZodOptional':
    case 'ZodEffects':
    case 'ZodBranded':
    case 'ZodCatch':
    case 'ZodReadonly':
    case 'ZodPipeline':
      return toJsonSchema(unwrap(s));
    default:
      return {};
  }
}
