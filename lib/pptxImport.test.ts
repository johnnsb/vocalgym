import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  decodeXmlEntities,
  extractSlides,
  notesPathFor,
  notesText,
  resolveTarget,
  slideOrder,
  slideTitle,
  slidesFromZip,
} from "./pptxImport";

const sp = (phType: string | null, paras: string[]) =>
  `<p:sp><p:nvSpPr><p:nvPr>${phType ? `<p:ph type="${phType}"/>` : ""}</p:nvPr></p:nvSpPr><p:txBody>${paras
    .map((t) => `<a:p><a:pPr/><a:r><a:rPr lang="en-US"/><a:t>${t}</a:t></a:r></a:p>`)
    .join("")}<a:p/></p:txBody></p:sp>`;
const slideXml = (title: string, body = "Bullet") =>
  `<p:sld><p:cSld><p:spTree>${sp("title", [title])}${sp(null, [body])}</p:spTree></p:cSld></p:sld>`;
const notesXml = (paras: string[]) =>
  `<p:notes><p:cSld><p:spTree>${sp("sldImg", [])}${sp("body", paras)}${sp("sldNum", ["7"])}</p:spTree></p:cSld></p:notes>`;

const PRES = `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`;
const PRES_RELS = `<Relationships><Relationship Id="rId2" Type="http://x/slide" Target="slides/slide10.xml"/><Relationship Target="slides/slide2.xml" Id="rId3" Type="http://x/slide"/><Relationship Id="rId1" Type="http://x/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>`;

describe("decodeXmlEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeXmlEntities("R&amp;D &lt;b&gt; &quot;q&quot; it&apos;s &#8217; &#x2014;")).toBe(
      "R&D <b> \"q\" it's ’ —",
    );
  });
});

describe("slideOrder", () => {
  it("follows sldIdLst, not file names", () => {
    expect(slideOrder(PRES, PRES_RELS)).toEqual(["ppt/slides/slide2.xml", "ppt/slides/slide10.xml"]);
  });
  it("handles absolute targets", () => {
    const rels = `<Relationships><Relationship Id="rId3" Target="/ppt/slides/slide2.xml"/><Relationship Id="rId2" Target="/ppt/slides/slide1.xml"/></Relationships>`;
    expect(slideOrder(PRES, rels)).toEqual(["ppt/slides/slide2.xml", "ppt/slides/slide1.xml"]);
  });
});

describe("resolveTarget / notesPathFor", () => {
  it("resolves ../ relative to the source part's folder", () => {
    expect(resolveTarget("ppt/slides/slide1.xml", "../notesSlides/notesSlide1.xml")).toBe(
      "ppt/notesSlides/notesSlide1.xml",
    );
  });
  it("finds the notesSlide relationship", () => {
    const rels = `<Relationships><Relationship Id="rId1" Type="http://x/slideLayout" Target="../slideLayouts/slideLayout2.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide3.xml"/></Relationships>`;
    expect(notesPathFor(rels, "ppt/slides/slide3.xml")).toBe("ppt/notesSlides/notesSlide3.xml");
    expect(notesPathFor("<Relationships/>", "ppt/slides/slide3.xml")).toBeNull();
  });
});

describe("slideTitle / notesText", () => {
  it("reads the title placeholder only", () => {
    expect(slideTitle(slideXml("Pricing &amp; tiers", "Not the title"))).toBe("Pricing & tiers");
    expect(slideTitle(`<p:sld>${sp("ctrTitle", ["Welcome"])}</p:sld>`)).toBe("Welcome");
    expect(slideTitle(`<p:sld>${sp(null, ["no title"])}</p:sld>`)).toBe("");
  });
  it("reads the notes body, one line per paragraph, without the slide number", () => {
    expect(notesText(notesXml(["Three tiers", "Anchor on Pro"]))).toBe("Three tiers\nAnchor on Pro");
  });
  it("returns an empty string when there are no notes", () => {
    expect(notesText(notesXml([]))).toBe("");
  });
});

function buildPptx(slides: { title: string; notes: string[] | null }[]): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const ids = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 10}"/>`).join("");
  files["ppt/presentation.xml"] = strToU8(`<p:presentation><p:sldIdLst>${ids}</p:sldIdLst></p:presentation>`);
  files["ppt/_rels/presentation.xml.rels"] = strToU8(
    `<Relationships>${slides.map((_, i) => `<Relationship Id="rId${i + 10}" Type="http://x/slide" Target="slides/slide${i + 1}.xml"/>`).join("")}</Relationships>`,
  );
  slides.forEach((s, i) => {
    files[`ppt/slides/slide${i + 1}.xml`] = strToU8(slideXml(s.title));
    files[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = strToU8(
      s.notes
        ? `<Relationships><Relationship Id="rId2" Type="http://x/relationships/notesSlide" Target="../notesSlides/notesSlide${i + 1}.xml"/></Relationships>`
        : "<Relationships/>",
    );
    if (s.notes) files[`ppt/notesSlides/notesSlide${i + 1}.xml`] = strToU8(notesXml(s.notes));
  });
  return files;
}

describe("slidesFromZip", () => {
  it("builds slides with titles and notes in presentation order", () => {
    const r = slidesFromZip(buildPptx([{ title: "Intro", notes: ["Hook"] }, { title: "Pricing", notes: null }]));
    expect(r.slides.map((s) => [s.title, s.notes])).toEqual([["Intro", "Hook"], ["Pricing", ""]]);
    expect(r.hadNotes).toBe(true);
    expect(r.truncated).toBe(false);
    expect(new Set(r.slides.map((s) => s.id)).size).toBe(2);
  });
  it("flags a deck with no notes", () => {
    expect(slidesFromZip(buildPptx([{ title: "A", notes: null }])).hadNotes).toBe(false);
  });
  it("trims a 60-slide deck to 40", () => {
    const big = Array.from({ length: 60 }, (_, i) => ({ title: `S${i}`, notes: ["n"] }));
    const r = slidesFromZip(buildPptx(big));
    expect(r.slides).toHaveLength(40);
    expect(r.truncated).toBe(true);
  });
  it("throws a friendly error without presentation.xml", () => {
    expect(() => slidesFromZip({})).toThrow("Couldn't read that PowerPoint file.");
  });
  it("throws when the deck has no slides", () => {
    expect(() => slidesFromZip(buildPptx([]))).toThrow("That deck has no slides.");
  });
});

describe("extractSlides", () => {
  it("reads a real in-memory .pptx file", async () => {
    const bytes = zipSync(buildPptx([{ title: "Hello", notes: ["World"] }]));
    const file = new File([bytes], "deck.pptx");
    const r = await extractSlides(file);
    expect(r.slides[0]).toMatchObject({ title: "Hello", notes: "World" });
  });
  it("rejects legacy .ppt and non-zip files", async () => {
    await expect(extractSlides(new File(["x"], "old.ppt"))).rejects.toThrow("Save it as .pptx and try again.");
    await expect(extractSlides(new File(["not a zip"], "deck.pptx"))).rejects.toThrow("Couldn't read that PowerPoint file.");
  });
});

describe("line breaks inside a paragraph (<a:br/>)", () => {
  const brShape = (t: string) =>
    `<p:sp><p:nvSpPr><p:nvPr><p:ph type="${t}"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Q3 Results</a:t></a:r><a:br><a:rPr lang="en-US"/></a:br><a:r><a:t>and Outlook</a:t></a:r><a:br/><a:r><a:t>2026</a:t></a:r></a:p></p:txBody></p:sp>`;
  it("keeps words apart in titles", () => {
    expect(slideTitle(`<p:sld>${brShape("title")}</p:sld>`)).toBe("Q3 Results and Outlook 2026");
  });
  it("keeps the line break in notes", () => {
    expect(notesText(`<p:notes>${brShape("body")}</p:notes>`)).toBe("Q3 Results\nand Outlook\n2026");
  });
});
