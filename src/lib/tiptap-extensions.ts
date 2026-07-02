import { Node, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (variant?: "info" | "warn" | "success" | "danger" | "tip") => ReturnType;
      toggleCallout: (variant?: "info" | "warn" | "success" | "danger" | "tip") => ReturnType;
      unsetCallout: () => ReturnType;
    };
    details: {
      insertDetails: () => ReturnType;
    };
    videoEmbed: {
      setVideo: (options: { src: string }) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      variant: {
        default: "info",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-variant") || "info",
        renderHTML: (attrs) => ({ "data-variant": attrs.variant }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-callout": "",
        class: `callout callout-${node.attrs.variant}`,
      }),
      0,
    ];
  },
  addCommands() {
    return {
      setCallout:
        (variant = "info") =>
        ({ commands }) =>
          commands.wrapIn(this.name, { variant }),
      toggleCallout:
        (variant = "info") =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { variant }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});

export const DetailsBlock = Node.create({
  name: "detailsBlock",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      summary: { default: "Clique para expandir" },
      open: { default: false },
    };
  },
  parseHTML() {
    return [
      {
        tag: "details",
        getAttrs: (el) => ({
          summary:
            (el as HTMLElement).querySelector("summary")?.textContent ||
            "Clique para expandir",
          open: (el as HTMLElement).hasAttribute("open"),
        }),
        contentElement: (el) => {
          const clone = el.cloneNode(true) as HTMLElement;
          clone.querySelector("summary")?.remove();
          return clone;
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes, {
        class: "toggle-block",
        ...(node.attrs.open ? { open: "" } : {}),
      }),
      ["summary", {}, node.attrs.summary || "Detalhes"],
      ["div", { class: "toggle-content" }, 0],
    ];
  },
  addCommands() {
    return {
      insertDetails:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { summary: "Clique para expandir", open: true },
            content: [{ type: "paragraph" }],
          }),
    };
  },
  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const dom = document.createElement("details");
      Object.entries(mergeAttributes(HTMLAttributes, { class: "toggle-block" })).forEach(
        ([k, v]) => dom.setAttribute(k, String(v)),
      );
      if (node.attrs.open) dom.setAttribute("open", "");
      const summary = document.createElement("summary");
      summary.contentEditable = "true";
      summary.textContent = node.attrs.summary || "Detalhes";
      summary.addEventListener("input", () => {
        if (typeof getPos !== "function") return;
        editor.view.dispatch(
          editor.view.state.tr.setNodeMarkup(getPos(), undefined, {
            ...node.attrs,
            summary: summary.textContent || "",
          }),
        );
      });
      const content = document.createElement("div");
      content.className = "toggle-content";
      dom.append(summary, content);
      return { dom, contentDOM: content };
    };
  },
});

export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: "",
        playsinline: "",
        preload: "metadata",
        class: "tiptap-video",
      }),
    ];
  },
  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
    };
  },
});

export const AlignableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-align"),
        renderHTML: (attrs) =>
          attrs.align
            ? {
                "data-align": attrs.align,
                class: `img-align-${attrs.align}`,
              }
            : {},
      },
      width: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("width"),
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
    };
  },
});