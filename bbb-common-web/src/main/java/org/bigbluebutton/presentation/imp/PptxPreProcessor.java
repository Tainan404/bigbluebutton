/**
 * BigBlueButton open source conferencing system - http://www.bigbluebutton.org/
 *
 * Copyright (c) 2012 BigBlueButton Inc. and by respective authors (see below).
 *
 * This program is free software; you can redistribute it and/or modify it under the
 * terms of the GNU Lesser General Public License as published by the Free Software
 * Foundation; either version 3.0 of the License, or (at your option) any later
 * version.
 *
 * BigBlueButton is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License along
 * with BigBlueButton; if not, see <http://www.gnu.org/licenses/>.
 *
 */
package org.bigbluebutton.presentation.imp;

import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;

import org.bigbluebutton.presentation.UploadedPresentation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

/**
 * Pre-processes an uploaded {@code .pptx} (OOXML) file, in place, before it is
 * rendered to PDF by LibreOffice.
 *
 * <p>PowerPoint stores super/subscript text as an ordinary run whose {@code
 * <a:rPr baseline="...">} carries the vertical offset (e.g. {@code mg/m} + a
 * {@code baseline="30000"} run holding an ASCII {@code 3} = {@code mg/m³}). Once
 * the deck is rendered to PDF the baseline is baked into glyph position and
 * {@code pdftotext} drops it, flattening {@code mg/m³} to {@code mg/m3}. To keep
 * the character in the extracted slide text we rewrite such runs to the Unicode
 * super/subscript equivalents before the PDF is produced.</p>
 *
 * <p>The rewrite is scoped to {@code ppt/slides/slideN.xml} entries; every other
 * part of the package is copied through verbatim so the file stays a valid OOXML
 * document. Any failure leaves the original file untouched.</p>
 */
public final class PptxPreProcessor {
  private static final Logger log = LoggerFactory.getLogger(PptxPreProcessor.class);

  private static final String NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";

  private static final Map<Character, Character> SUPERSCRIPT = new HashMap<>();
  private static final Map<Character, Character> SUBSCRIPT = new HashMap<>();

  static {
    final String digits = "0123456789";
    final String sup = "⁰¹²³⁴⁵⁶⁷⁸⁹";
    final String sub = "₀₁₂₃₄₅₆₇₈₉";
    for (int i = 0; i < digits.length(); i++) {
      SUPERSCRIPT.put(digits.charAt(i), sup.charAt(i));
      SUBSCRIPT.put(digits.charAt(i), sub.charAt(i));
    }
    SUPERSCRIPT.put('+', '⁺');
    SUPERSCRIPT.put('-', '⁻');
    SUPERSCRIPT.put('=', '⁼');
    SUPERSCRIPT.put('(', '⁽');
    SUPERSCRIPT.put(')', '⁾');
    SUPERSCRIPT.put('n', 'ⁿ');
    SUPERSCRIPT.put('i', 'ⁱ');

    SUBSCRIPT.put('+', '₊');
    SUBSCRIPT.put('-', '₋');
    SUBSCRIPT.put('=', '₌');
    SUBSCRIPT.put('(', '₍');
    SUBSCRIPT.put(')', '₎');
    final String subLetters = "aeoxhklmnpst";
    final String subLettersMapped = "ₐₑₒₓₕₖₗₘₙₚₛₜ";
    for (int i = 0; i < subLetters.length(); i++) {
      SUBSCRIPT.put(subLetters.charAt(i), subLettersMapped.charAt(i));
    }
  }

  private PptxPreProcessor() {
  }

  /**
   * Rewrites {@code pres}'s uploaded {@code .pptx} in place. Must only be called
   * for {@code .pptx} uploads. On any error the original file is left unchanged.
   */
  public static void process(UploadedPresentation pres) {
    File input = pres.getUploadedFile();
    if (input == null || !input.isFile()) {
      return;
    }

    File tmp = null;
    try {
      tmp = File.createTempFile("bbb-pptx-pre-", ".pptx", input.getParentFile());
      boolean changed = rewrite(input, tmp);
      if (changed) {
        Files.move(tmp.toPath(), input.toPath(), StandardCopyOption.REPLACE_EXISTING);
        log.info("Pre-processed pptx {} (presId={}) to preserve super/subscript text.",
            pres.getName(), pres.getId());
      } else {
        tmp.delete();
      }
    } catch (Exception e) {
      if (tmp != null && tmp.exists()) {
        tmp.delete();
      }
      log.warn("Failed to pre-process pptx {} (presId={}); using original file. Reason: {}",
          pres.getName(), pres.getId(), e.toString());
    }
  }

  private static boolean rewrite(File in, File out) throws IOException {
    boolean anyChanged = false;
    try (ZipFile zin = new ZipFile(in);
         ZipOutputStream zout = new ZipOutputStream(new BufferedOutputStream(new FileOutputStream(out)))) {
      Enumeration<? extends ZipEntry> entries = zin.entries();
      while (entries.hasMoreElements()) {
        ZipEntry entry = entries.nextElement();
        byte[] data;
        try (InputStream is = zin.getInputStream(entry)) {
          data = is.readAllBytes();
        }
        if (isSlideXml(entry.getName())) {
          byte[] transformed = transformSlideXml(data);
          if (transformed != null) {
            data = transformed;
            anyChanged = true;
          }
        }
        zout.putNextEntry(new ZipEntry(entry.getName()));
        zout.write(data);
        zout.closeEntry();
      }
    }
    return anyChanged;
  }

  private static boolean isSlideXml(String name) {
    return name.matches("ppt/slides/slide\\d+\\.xml");
  }

  private static byte[] transformSlideXml(byte[] xml) {
    try {
      Document doc = parse(xml);
      boolean changed = inlineSuperSubscript(doc);
      if (!changed) {
        return null;
      }
      return serialize(doc);
    } catch (Exception e) {
      log.warn("Failed to transform slide xml; leaving it unchanged. Reason: {}", e.toString());
      return null;
    }
  }

  /**
   * Bug 2: replaces the text of every run carrying a non-zero {@code baseline}
   * with its Unicode super/subscript equivalent and drops the baseline so the
   * glyph is emitted verbatim by {@code pdftotext}. Characters without a Unicode
   * equivalent are left untouched (no worse than today).
   */
  private static boolean inlineSuperSubscript(Document doc) {
    boolean changed = false;
    NodeList runs = doc.getElementsByTagNameNS(NS_A, "r");
    for (int i = 0; i < runs.getLength(); i++) {
      Element run = (Element) runs.item(i);
      Element rPr = firstChild(run, NS_A, "rPr");
      if (rPr == null || !rPr.hasAttribute("baseline")) {
        continue;
      }
      int baseline;
      try {
        baseline = Integer.parseInt(rPr.getAttribute("baseline").trim());
      } catch (NumberFormatException e) {
        continue;
      }
      if (baseline == 0) {
        continue;
      }
      Map<Character, Character> table = baseline > 0 ? SUPERSCRIPT : SUBSCRIPT;
      Element t = firstChild(run, NS_A, "t");
      if (t == null) {
        continue;
      }
      String text = t.getTextContent();
      if (text == null || text.isEmpty()) {
        continue;
      }
      String mapped = mapText(text, table);
      if (!mapped.equals(text)) {
        t.setTextContent(mapped);
        rPr.removeAttribute("baseline");
        changed = true;
      }
    }
    return changed;
  }

  private static String mapText(String text, Map<Character, Character> table) {
    StringBuilder sb = new StringBuilder(text.length());
    for (int i = 0; i < text.length(); i++) {
      char ch = text.charAt(i);
      Character mapped = table.get(ch);
      sb.append(mapped != null ? mapped.charValue() : ch);
    }
    return sb.toString();
  }

  private static Document parse(byte[] xml) throws Exception {
    DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
    dbf.setNamespaceAware(true);
    dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
    dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
    dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
    dbf.setXIncludeAware(false);
    dbf.setExpandEntityReferences(false);
    DocumentBuilder db = dbf.newDocumentBuilder();
    return db.parse(new ByteArrayInputStream(xml));
  }

  private static byte[] serialize(Document doc) throws Exception {
    TransformerFactory tf = TransformerFactory.newInstance();
    tf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
    Transformer t = tf.newTransformer();
    t.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
    t.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no");
    ByteArrayOutputStream bos = new ByteArrayOutputStream();
    t.transform(new DOMSource(doc), new StreamResult(bos));
    return bos.toByteArray();
  }

  private static Element firstChild(Element parent, String ns, String local) {
    NodeList children = parent.getChildNodes();
    for (int i = 0; i < children.getLength(); i++) {
      Node n = children.item(i);
      if (n.getNodeType() == Node.ELEMENT_NODE
          && ns.equals(n.getNamespaceURI()) && local.equals(n.getLocalName())) {
        return (Element) n;
      }
    }
    return null;
  }
}
