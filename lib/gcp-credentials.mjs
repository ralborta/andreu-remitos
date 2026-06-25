/** Credenciales compartidas para clientes GCP (Document AI, Speech, etc.) */
export function gcpClientOptions(apiEndpoint) {
  const opts = apiEndpoint ? { apiEndpoint } : {};
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  if (json) {
    const creds = JSON.parse(json);
    return {
      ...opts,
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key,
      },
    };
  }
  return opts;
}
