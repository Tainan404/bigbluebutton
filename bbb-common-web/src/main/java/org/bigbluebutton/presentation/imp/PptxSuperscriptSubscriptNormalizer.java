/**
 * BigBlueButton open source conferencing system - http://www.bigbluebutton.org/
 *
 * Copyright (c) 2026 BigBlueButton Inc. and by respective authors (see below).
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
 */
package org.bigbluebutton.presentation.imp;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.HashMap;
import java.util.Map;

import org.apache.commons.io.FilenameUtils;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFTextParagraph;
import org.apache.poi.xslf.usermodel.XSLFTextRun;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.bigbluebutton.presentation.FileTypeConstants;
import org.openxmlformats.schemas.drawingml.x2006.main.CTRegularTextRun;
import org.openxmlformats.schemas.drawingml.x2006.main.CTTextCharacterProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PptxSuperscriptSubscriptNormalizer {
  private static final Logger log = LoggerFactory.getLogger(PptxSuperscriptSubscriptNormalizer.class);

  // PPTX files above this size skip normalization: newXMLSlideShow loads the whole deck into memory and
  // write() serializes a full copy, so large decks under concurrent uploads risk memory pressure.
  // Poll slides are text-light, so a big deck is the least likely to hold the runs we care about.
  private static final long MAX_NORMALIZATION_SIZE_BYTES = 50L * 1024 * 1024;

  // Character maps for the superscript/subscript runs we can flatten to Unicode. Scope is
  // intentionally minimal: digits 0-9, the math symbols + - = ( ), and the letter n (nth
  // exponent/index). Everything else - other letters, spaces, decimal points, commas - has no
  // mapping, so normalizeText returns null and the run is left untouched (all-or-nothing per run).
  // Out of scope by design: ordinals such as 1st, and general chemical/math letter sub/superscripts.
  private static final Map<Character, Character> SUPERSCRIPT_CHARACTERS = new HashMap<>();
  private static final Map<Character, Character> SUBSCRIPT_CHARACTERS = new HashMap<>();

  static {
    addMappings(SUPERSCRIPT_CHARACTERS, "0123456789+-=()n", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ");
    addMappings(SUBSCRIPT_CHARACTERS, "0123456789+-=()n", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₙ");
  }

  public File normalize(File pptx, String presId) {
    if (!FilenameUtils.isExtension(pptx.getName(), FileTypeConstants.PPTX)) {
      return null;
    }

    if (pptx.length() > MAX_NORMALIZATION_SIZE_BYTES) {
      log.info("Skipping superscript/subscript normalization for presId={} filename={}; size {} bytes exceeds limit {} bytes",
          presId, pptx.getName(), pptx.length(), MAX_NORMALIZATION_SIZE_BYTES);
      return null;
    }

    File normalizedPptx = new File(pptx.getParentFile(),
        FilenameUtils.removeExtension(pptx.getName()) + ".normalized.pptx");

    try (FileInputStream input = new FileInputStream(pptx);
        XMLSlideShow slideShow = new XMLSlideShow(input)) {
      boolean rewritten = normalizeRuns(slideShow);
      if (!rewritten) {
        return null;
      }

      try (FileOutputStream output = new FileOutputStream(normalizedPptx)) {
        slideShow.write(output);
      }
      return normalizedPptx;
    } catch (Exception e) {
      if (normalizedPptx.exists() && !normalizedPptx.delete()) {
        log.warn("Failed to delete incomplete normalized PPTX for presId={} filename={}",
            presId, pptx.getName());
      }
      log.warn("Failed to normalize superscript/subscript runs for presId={} filename={}; using original file",
          presId, pptx.getName(), e);
      return null;
    }
  }

  static String normalizeText(String text, boolean superscript) {
    Map<Character, Character> characters = superscript ? SUPERSCRIPT_CHARACTERS : SUBSCRIPT_CHARACTERS;
    StringBuilder normalized = new StringBuilder(text.length());
    for (int i = 0; i < text.length(); i++) {
      Character replacement = characters.get(text.charAt(i));
      if (replacement == null) {
        return null;
      }
      normalized.append(replacement);
    }
    return normalized.toString();
  }

  private boolean normalizeRuns(XMLSlideShow slideShow) {
    boolean rewritten = false;
    for (org.apache.poi.xslf.usermodel.XSLFSlide slide : slideShow.getSlides()) {
      for (XSLFShape shape : slide.getShapes()) {
        if (!(shape instanceof XSLFTextShape)) {
          continue;
        }
        XSLFTextShape textShape = (XSLFTextShape) shape;
        for (XSLFTextParagraph paragraph : textShape.getTextParagraphs()) {
          for (XSLFTextRun run : paragraph.getTextRuns()) {
            if (normalizeRun(run)) {
              rewritten = true;
            }
          }
        }
      }
    }
    return rewritten;
  }

  private boolean normalizeRun(XSLFTextRun run) {
    CTRegularTextRun xmlRun = (CTRegularTextRun) run.getXmlObject();
    CTTextCharacterProperties properties = xmlRun.getRPr();
    if (properties == null || !properties.isSetBaseline()) {
      return false;
    }

    int baseline = ((Number) properties.getBaseline()).intValue();
    if (baseline == 0) {
      return false;
    }

    String normalized = normalizeText(run.getRawText(), baseline > 0);
    if (normalized == null) {
      return false;
    }

    run.setText(normalized);
    properties.setBaseline(0);
    return true;
  }

  private static void addMappings(Map<Character, Character> mappings, String source, String target) {
    for (int i = 0; i < source.length(); i++) {
      mappings.put(source.charAt(i), target.charAt(i));
    }
  }
}
