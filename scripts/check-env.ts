function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requiredUrlEnv(name: string) {
  const value = requiredEnv(name);
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  return value;
}

try {
  const selfUrl = requiredUrlEnv("SELF_URL");
  console.log(JSON.stringify({ ok: true, selfUrl }));
} catch (error) {
  console.error(error);
  process.exit(1);
}
