export function logJobEvent(data: Record<string, any>) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...data,
    }),
  );
}
