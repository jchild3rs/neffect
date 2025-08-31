import { Chunk } from "effect";

export const DOCTYPE = "<!DOCTYPE html>";
export const DOCTYPE_HTML_CHUNK = Chunk.of(new TextEncoder().encode(DOCTYPE));
