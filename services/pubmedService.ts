import { Paper } from '../types';

const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const DB = 'pubmed';

export const searchPubMed = async (query: string, retStart: number = 0, retMax: number = 10): Promise<{ids: string[], count: number}> => {
  try {
    const params = new URLSearchParams({
      db: DB,
      term: query,
      retstart: retStart.toString(),
      retmax: retMax.toString(),
      retmode: 'json',
      sort: 'date'
    });

    const response = await fetch(`${BASE_URL}/esearch.fcgi?${params.toString()}`);
    const data = await response.json();
    
    if (!data.esearchresult || !data.esearchresult.idlist) {
      return { ids: [], count: 0 };
    }
    
    return {
        ids: data.esearchresult.idlist,
        count: parseInt(data.esearchresult.count || '0', 10)
    };
  } catch (error) {
    console.error("PubMed Search Error:", error);
    return { ids: [], count: 0 };
  }
};

// Helper to split array into chunks
const chunkArray = (array: string[], size: number) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

export const fetchPaperDetails = async (ids: string[]): Promise<Paper[]> => {
  if (ids.length === 0) return [];

  // PubMed URL length limit protection.
  // We fetch in batches of 200 IDs max.
  const BATCH_SIZE = 200;
  const batches = chunkArray(ids, BATCH_SIZE);
  let allPapers: Paper[] = [];

  try {
    for (const batchIds of batches) {
      const params = new URLSearchParams({
        db: DB,
        id: batchIds.join(','),
        retmode: 'xml'
      });

      const response = await fetch(`${BASE_URL}/efetch.fcgi?`, {
        method: 'POST', // Use POST for larger ID lists
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });

      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      
      const articles = xmlDoc.getElementsByTagName("PubmedArticle");

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        
        const id = article.getElementsByTagName("PMID")[0]?.textContent || "";
        const articleTitle = article.getElementsByTagName("ArticleTitle")[0]?.textContent || "No Title";
        
        // Abstract extraction
        const abstractTexts = article.getElementsByTagName("AbstractText");
        let abstract = "";
        if (abstractTexts.length > 0) {
            for (let j = 0; j < abstractTexts.length; j++) {
              const label = abstractTexts[j].getAttribute("Label");
              const textContent = abstractTexts[j].textContent;
              if (label) {
                  abstract += `${label}: ${textContent} `;
              } else {
                  abstract += `${textContent} `;
              }
            }
        } else {
            abstract = "No abstract available.";
        }

        // Year extraction
        let year = new Date().getFullYear();
        const pubDate = article.getElementsByTagName("PubDate")[0];
        if (pubDate) {
            const yearNode = pubDate.getElementsByTagName("Year")[0];
            if (yearNode) {
                year = parseInt(yearNode.textContent || "");
            } else {
                 const medlineDate = pubDate.getElementsByTagName("MedlineDate")[0];
                 if (medlineDate) {
                     const match = medlineDate.textContent?.match(/\d{4}/);
                     if (match) year = parseInt(match[0]);
                 }
            }
        }

        // Journal Title
        const journalTitle = article.querySelector("Journal > Title")?.textContent || 
                             article.querySelector("Journal > ISOAbbreviation")?.textContent || 
                             "Unknown Journal";
        
        // Authors
        const authorList = article.getElementsByTagName("Author");
        const authors: string[] = [];
        for(let k=0; k < Math.min(authorList.length, 5); k++) {
            const lastName = authorList[k].getElementsByTagName("LastName")[0]?.textContent || "";
            const initials = authorList[k].getElementsByTagName("Initials")[0]?.textContent || "";
            if (lastName) authors.push(`${lastName} ${initials}`);
        }

        allPapers.push({
          id,
          title: articleTitle,
          abstract: abstract.trim(),
          year,
          journal: journalTitle,
          authors
        });
      }
      
      // Small delay between batches to be nice to API
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return allPapers;
  } catch (error) {
    console.error("PubMed Fetch Details Error:", error);
    return allPapers; // Return what we got so far
  }
};