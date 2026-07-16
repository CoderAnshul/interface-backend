import * as cheerio from "cheerio";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export async function extractTextFromPdf(buffer) {
    try {
        // PDF text extraction disabled - file stored without content
        // For production, consider using services like AWS Textract or Google Document AI
        return 'PDF uploaded';
    } catch (error) {
        console.error("Error handling PDF:", error);
        throw new Error(`Failed to process PDF: ${error.message}`);
    }
}

export async function extractTextFromDocx(buffer) {
    try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value.trim();
    } catch (error) {
        console.error("Error parsing DOCX:", error);
        throw new Error("Failed to parse DOCX");
    }
}

export async function extractTextFromXlsx(buffer) {
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        let text = "";
        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            text += XLSX.utils.sheet_to_txt(sheet) + "\n";
        });
        return text.trim();
    } catch (error) {
        console.error("Error parsing XLSX:", error);
        throw new Error("Failed to parse XLSX");
    }
}

export async function extractTextFromTxt(buffer) {
    try {
        return buffer.toString('utf-8').trim();
    } catch (error) {
        console.error("Error parsing TXT:", error);
        throw new Error("Failed to parse TXT");
    }
}

export async function extractTextFromUrl(url) {
    try {
        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('footer').remove();

        const text = $('body').text().replace(/\s+/g, ' ').trim();

        if (!text) {
            throw new Error('No text content found in URL');
        }

        return text;
    } catch (error) {
        console.error('Error extracting text from URL:', error);
        throw new Error(`Failed to fetch URL: ${error.message}`);
    }
}

export function chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = []
    let start = 0

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length)
        chunks.push(text.slice(start, end))
        start += chunkSize - overlap
    }

    return chunks
}
