export interface RichTextMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface RichTextNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: RichTextMark[];
  text?: string;
}

export interface RichTextDocument extends RichTextNode {
  type: "doc";
  content: RichTextNode[];
}

export interface ArticleFootnote {
  id: string;
  number: number;
  text: string;
}

export function getFootnotesFromBody(
  body: RichTextDocument,
): ArticleFootnote[] {
  const footnotes: ArticleFootnote[] = [];

  function visit(node: RichTextNode): void {
    if (node.type === "footnote") {
      const text = String(node.attrs?.text ?? "").trim();

      if (text) {
        const number = Number(node.attrs?.number);
        footnotes.push({
          id: String(node.attrs?.id ?? `footnote-${footnotes.length + 1}`),
          number: Number.isFinite(number) && number > 0
            ? Math.floor(number)
            : footnotes.length + 1,
          text,
        });
      }
    }

    node.content?.forEach(visit);
  }

  visit(body);
  return footnotes;
}

export type LegacyArticleBody = string[];

export type StoredArticleBody =
  | LegacyArticleBody
  | RichTextDocument;

export function isLegacyArticleBody(
  body: unknown
): body is LegacyArticleBody {
  return (
    Array.isArray(body) &&
    body.every(
      (paragraph) => typeof paragraph === "string"
    )
  );
}

export function isRichTextDocument(
  body: unknown
): body is RichTextDocument {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return false;
  }

  const candidate = body as {
    type?: unknown;
    content?: unknown;
  };

  return (
    candidate.type === "doc" &&
    Array.isArray(candidate.content)
  );
}

export function legacyBodyToRichText(
  paragraphs: LegacyArticleBody
): RichTextDocument {
  const content: RichTextNode[] = paragraphs
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: paragraph,
        },
      ],
    }));

  return {
    type: "doc",
    content:
      content.length > 0
        ? content
        : [{ type: "paragraph" }],
  };
}

export function normalizeArticleBody(
  body: unknown
): RichTextDocument {
  if (isRichTextDocument(body)) {
    return body;
  }

  if (isLegacyArticleBody(body)) {
    return legacyBodyToRichText(body);
  }

  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

export function getPlainTextFromNode(
  node: RichTextNode
): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  if (!node.content) {
    return "";
  }

  return node.content
    .map(getPlainTextFromNode)
    .join(
      node.type === "doc" ||
        node.type === "paragraph" ||
        node.type === "heading" ||
        node.type === "blockquote" ||
        node.type === "pullQuote" ||
        node.type === "listItem"
        ? "\n"
        : ""
    );
}

export function getPlainTextFromBody(
  body: StoredArticleBody
): string {
  if (isLegacyArticleBody(body)) {
    return body.join("\n\n");
  }

  return getPlainTextFromNode(body)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function bodyHasContent(
  body: StoredArticleBody
): boolean {
  return getPlainTextFromBody(body).trim().length > 0;
}
