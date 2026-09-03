package org.bigbluebutton.presentation.imp;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFTextBox;
import org.apache.poi.xslf.usermodel.XSLFTextRun;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.openxmlformats.schemas.drawingml.x2006.main.CTRegularTextRun;

public class PptxSuperscriptSubscriptNormalizerTest {
  @Rule
  public TemporaryFolder temporaryFolder = new TemporaryFolder();

  private final PptxSuperscriptSubscriptNormalizer normalizer = new PptxSuperscriptSubscriptNormalizer();

  @Test
  public void mapsSuperscriptCharacters() {
    assertEquals("⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ",
        PptxSuperscriptSubscriptNormalizer.normalizeText("0123456789+-=()n", true));
  }

  @Test
  public void mapsSubscriptCharacters() {
    assertEquals("₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₙ",
        PptxSuperscriptSubscriptNormalizer.normalizeText("0123456789+-=()n", false));
  }

  @Test
  public void leavesRunUntouchedWhenAnyCharacterCannotBeMapped() {
    assertNull(PptxSuperscriptSubscriptNormalizer.normalizeText("x2", true));
  }

  @Test
  public void rewritesBaselineRunsInScratchCopyAndLeavesOriginalUntouched() throws Exception {
    File input = createPresentation("baseline.pptx", "3", 30000, "2", -25000);
    byte[] originalBytes = Files.readAllBytes(input.toPath());

    File normalized = normalizer.normalize(input, "presentation-id");

    assertTrue(normalized.exists());
    assertFalse(input.equals(normalized));
    assertArrayEquals(originalBytes, Files.readAllBytes(input.toPath()));
    try (FileInputStream stream = new FileInputStream(normalized);
        XMLSlideShow slideShow = new XMLSlideShow(stream)) {
      XSLFTextBox textBox = (XSLFTextBox) slideShow.getSlides().get(0).getShapes().get(0);
      XSLFTextRun superscript = textBox.getTextParagraphs().get(1).getTextRuns().get(0);
      XSLFTextRun subscript = textBox.getTextParagraphs().get(2).getTextRuns().get(0);
      assertEquals("³", superscript.getRawText());
      assertEquals("₂", subscript.getRawText());
      assertEquals(0, ((Number) ((CTRegularTextRun) superscript.getXmlObject()).getRPr().getBaseline()).intValue());
      assertEquals(0, ((Number) ((CTRegularTextRun) subscript.getXmlObject()).getRPr().getBaseline()).intValue());
    }
  }

  @Test
  public void returnsNullWhenNoRunCanBeFullyMapped() throws Exception {
    File input = createPresentation("unmapped.pptx", "x2", 30000);
    byte[] originalBytes = Files.readAllBytes(input.toPath());

    assertNull(normalizer.normalize(input, "presentation-id"));
    assertArrayEquals(originalBytes, Files.readAllBytes(input.toPath()));
  }

  @Test
  public void ignoresNonPptxFiles() throws Exception {
    File input = temporaryFolder.newFile("presentation.pdf");
    Files.write(input.toPath(), "not a pptx".getBytes(StandardCharsets.UTF_8));

    assertNull(normalizer.normalize(input, "presentation-id"));
  }

  @Test
  public void failsOpenForCorruptPptxAndLeavesOriginalUntouched() throws Exception {
    File input = temporaryFolder.newFile("corrupt.pptx");
    byte[] corruptBytes = "not a zip".getBytes(StandardCharsets.UTF_8);
    Files.write(input.toPath(), corruptBytes);

    assertNull(normalizer.normalize(input, "presentation-id"));
    assertArrayEquals(corruptBytes, Files.readAllBytes(input.toPath()));
    assertFalse(new File(temporaryFolder.getRoot(), "corrupt.normalized.pptx").exists());
  }

  private File createPresentation(String name, Object... runDefinitions) throws Exception {
    File input = temporaryFolder.newFile(name);
    try (XMLSlideShow slideShow = new XMLSlideShow()) {
      XSLFTextBox textBox = slideShow.createSlide().createTextBox();
      for (int i = 0; i < runDefinitions.length; i += 2) {
        XSLFTextRun run = textBox.addNewTextParagraph().addNewTextRun();
        run.setText((String) runDefinitions[i]);
        run.setBaselineOffset(((Integer) runDefinitions[i + 1]) / 1000.0);
      }
      try (FileOutputStream output = new FileOutputStream(input)) {
        slideShow.write(output);
      }
    }
    return input;
  }
}
