export function optionalData<Value>(modules: Record<string, unknown>, fallback: Value): Value {
  const [value] = Object.values(modules)

  return (value as Value | undefined) ?? fallback
}
