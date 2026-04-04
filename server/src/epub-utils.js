const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

/**
 * Extracts title, author, and cover image from an EPUB file.
 * Returns { title, author, coverData, coverExt }
 */
async function parseEpub(epubPath) {
  try {
    const data = fs.readFileSync(epubPath);
    const zip = await JSZip.loadAsync(data);

    // 1. Find the OPF file path via META-INF/container.xml
    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) return {};

    const containerXml = await containerFile.async('string');
    const opfMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!opfMatch) return {};

    const opfPath = opfMatch[1];
    const opfFile = zip.file(opfPath);
    if (!opfFile) return {};

    const opfContent = await opfFile.async('string');
    const opfDir = path.dirname(opfPath).replace(/^\.?\/?$/, '');

    // 2. Extract metadata
    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
    const author = authorMatch ? authorMatch[1].trim() : null;

    // 3. Find cover image href
    let coverHref = null;

    // Method A: <item properties="cover-image" href="...">
    const coverPropMatch = opfContent.match(/<item[^>]+properties="cover-image"[^>]*href="([^"]+)"/i)
      || opfContent.match(/href="([^"]+)"[^>]+properties="cover-image"/i);
    if (coverPropMatch) coverHref = coverPropMatch[1];

    // Method B: <meta name="cover" content="id"> then find item by id
    if (!coverHref) {
      const metaMatch = opfContent.match(/<meta\s+name="cover"\s+content="([^"]+)"/i)
        || opfContent.match(/<meta\s+content="([^"]+)"\s+name="cover"/i);
      if (metaMatch) {
        const coverId = metaMatch[1];
        const itemMatch = opfContent.match(
          new RegExp(`<item[^>]+id="${coverId}"[^>]+href="([^"]+)"`, 'i')
        ) || opfContent.match(
          new RegExp(`href="([^"]+)"[^>]+id="${coverId}"`, 'i')
        );
        if (itemMatch) coverHref = itemMatch[1];
      }
    }

    // Method C: item with cover in id and image media-type
    if (!coverHref) {
      const fallbackMatch = opfContent.match(
        /<item[^>]+id="[^"]*cover[^"]*"[^>]+href="([^"]+\.(?:jpg|jpeg|png|gif|webp))"/i
      );
      if (fallbackMatch) coverHref = fallbackMatch[1];
    }

    if (!coverHref) return { title, author };

    // 4. Resolve path inside ZIP
    const fullCoverPath = opfDir ? `${opfDir}/${coverHref}` : coverHref;
    const normalized = fullCoverPath.replace(/\/\//g, '/');

    const coverFile = zip.file(normalized) || zip.file(coverHref);
    if (!coverFile) return { title, author };

    const coverData = await coverFile.async('nodebuffer');
    const coverExt = path.extname(coverHref).toLowerCase() || '.jpg';

    return { title, author, coverData, coverExt };
  } catch (err) {
    console.error('EPUB parse error:', err.message);
    return {};
  }
}

module.exports = { parseEpub };
