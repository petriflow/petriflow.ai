export interface MultipartField {
  name: string;
  value: string;
}

export interface MultipartFile {
  name: string;
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export type MultipartPart = MultipartField | MultipartFile;

function isFile(part: MultipartPart): part is MultipartFile {
  return "filename" in part;
}

/** Builds a multipart/form-data body for Fastify inject requests. */
export function multipartBody(parts: MultipartPart[], boundary = "----petriflow-test-boundary") {
  const chunks: Buffer[] = [];

  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (isFile(part)) {
      chunks.push(Buffer.from(
        `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`,
      ));
      chunks.push(Buffer.from(`Content-Type: ${part.contentType ?? "application/xml"}\r\n\r\n`));
      chunks.push(Buffer.isBuffer(part.content) ? part.content : Buffer.from(part.content));
      chunks.push(Buffer.from("\r\n"));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n`));
      chunks.push(Buffer.from(part.value));
      chunks.push(Buffer.from("\r\n"));
    }
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}
