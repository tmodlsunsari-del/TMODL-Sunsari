// Use CDN for XLSX in worker to ensure maximum compatibility in the preview environment
importScripts('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');

console.log('Worker Environment Check: XLSX library is', typeof XLSX === 'undefined' ? 'NOT LOADED' : 'READY');

self.onmessage = async function(e) {
    const { type, data } = e.data;
    
    if (type === 'PING') {
        self.postMessage({ type: 'HEARTBEAT' });
        return;
    }
    
    if (type === 'INDEX_EXISTING') {
        indexRows(data, true, null, true);
    } else if (type === 'PARSE_JSON') {
        indexRows(data, true, null, true);
    } else if (type === 'PARSE_EXCEL') {
        try {
            self.postMessage({ type: 'STATUS', message: 'Decompressing identity ledger...' });
            
            // At this point, XLSX should be available globally via importScripts
            if (typeof XLSX === 'undefined') {
                throw new Error('XLSX library failed to load in background engine.');
            }

            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames && workbook.SheetNames.length > 0 ? workbook.SheetNames[0] : null;
            if (!sheetName) {
                throw new Error('Google Sheet workbook appears to be empty or has no visible sheets.');
            }
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
                throw new Error(`Google Sheet worksheet "${sheetName}" could not be read.`);
            }
            // Extract exact 2D array of cells to find original columns with 100% precision
            const sheetArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            if (!sheetArrays || !Array.isArray(sheetArrays)) {
                throw new Error(`Google Sheet "${sheetName}" has empty or invalid data layout.`);
            }
            
            // Extract starting row offset from worksheet range (!ref) to handle skipped leading empty rows
            let refStartRow = 1;
            if (worksheet && worksheet['!ref']) {
                const refParts = worksheet['!ref'].split(':');
                if (refParts[0]) {
                    const match = refParts[0].match(/\d+/);
                    if (match) {
                        refStartRow = parseInt(match[0], 10);
                    }
                }
            }
            console.log(`[Worker Sync] Worksheet !ref: ${worksheet['!ref'] || 'N/A'} -> Extracted start row offset: ${refStartRow}`);
            
            indexRows(null, true, sheetArrays, false, refStartRow);
        } catch (error) {
            self.postMessage({ type: 'ERROR', error: error.message });
        }
    }
};

function indexRows(rows, shouldReturnRows = false, sheetArrays = null, isAlreadyStandardized = false, refStartRow = 1) {
    self.postMessage({ type: 'STATUS', message: 'Mapping identity cluster...' });
    
    // Normalize rows to prevent reading properties/length of null/undefined values
    if (!rows || !Array.isArray(rows)) {
        rows = [];
    }

    // Auto-detect if row data is already standardized objects (from INDEX_EXISTING or local storage)
    if (!isAlreadyStandardized && rows.length > 0) {
        const firstRow = rows[0];
        if (firstRow && typeof firstRow === 'object' && !Array.isArray(firstRow)) {
            if ('Name' in firstRow && 'Applicant ID' in firstRow && 'License No' in firstRow) {
                isAlreadyStandardized = true;
            }
        }
    }

    const nameMap = new Map();
    const idMap = new Map();
    const licenseMap = new Map();

    if (isAlreadyStandardized) {
        const standardizedRows = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;
            
            const stdRow = {
                'S.N.': row['S.N.'] !== undefined ? String(row['S.N.']).trim() : (row['S.N'] !== undefined ? String(row['S.N']).trim() : (row['S. N.'] !== undefined ? String(row['S. N.']).trim() : '')),
                'Name': row['Name'] !== undefined ? String(row['Name']).trim() : '',
                'Applicant ID': row['Applicant ID'] !== undefined ? String(row['Applicant ID']).trim() : '',
                'License No': row['License No'] !== undefined ? String(row['License No']).trim() : '',
                'F/H Name': row['F/H Name'] !== undefined ? String(row['F/H Name']).trim() : (row['f_h_name'] !== undefined ? String(row['f_h_name']).trim() : ''),
                'Category': row['Category'] !== undefined ? String(row['Category']).trim() : (row['CATEGORY'] !== undefined ? String(row['CATEGORY']).trim() : ''),
                'Code No': row['Code No'] !== undefined ? String(row['Code No']).trim() : '',
                'Office Visit Day': row['Office Visit Day'] !== undefined ? String(row['Office Visit Day']).trim() : '',
                'RECEIVED BY': row['RECEIVED BY'] !== undefined ? String(row['RECEIVED BY']).trim() : '',
                '__rowIndex': row.__rowIndex !== undefined ? row.__rowIndex : i
            };
            
            // Carry over any other properties as is
            for (const k in row) {
                if (k !== '__rowIndex' && stdRow[k] === undefined) {
                    stdRow[k] = row[k];
                }
            }
            
            const rawName = stdRow['Name'].toLowerCase().trim();
            const rawId = stdRow['Applicant ID'].toLowerCase().trim();
            const rawLicense = stdRow['License No'].toLowerCase().trim();

            if (rawName && !nameMap.has(rawName)) nameMap.set(rawName, stdRow);
            if (rawId && !idMap.has(rawId)) idMap.set(rawId, stdRow);
            if (rawLicense && !licenseMap.has(rawLicense)) licenseMap.set(rawLicense, stdRow);

            standardizedRows.push(stdRow);
        }
        
        self.postMessage({ 
            type: 'COMPLETE', 
            count: standardizedRows.length, 
            isFreshSheet: !isAlreadyStandardized,
            maps: { nameMap, idMap, licenseMap },
            rows: shouldReturnRows ? standardizedRows : null,
            headers: ['S.N.', 'Applicant ID', 'Name', 'F/H Name', 'License No', 'Category', 'Code No', 'Office Visit Day', 'RECEIVED BY']
        });
        return;
    }
    
    // 1. Detect if there is a header row starting further down (often the case in Google Sheet layout dashboards)
    let headerRowIndex = -1;
    let maxHeaderMatches = -1;
    const targetHeaderKeywords = [
        's.n.', 's.n', 's. n.', 'serial no', 'sn',
        'applicant id', 'applicantid', 'form id', 'registration id', 'form no',
        'name', 'full name', 'full legal name', 'fullname', 'नाम',
        'license no', 'licenceno', 'license number', 'लाइसेन्स', 'licence', 'license',
        'code no', 'codeno', 'access code', 'code', 'कोड',
        'office visit day', 'visit day', 'scheduled appointment', 'visit date', 'day',
        'received by', 'receivedby',
        'f/h name', 'father/husband name', 'category', 'class', 'वर्ग', 'cat', 'la-class', 'class (वर्ग)'
    ];

    let originalHeadersList = [];
    let detectedRows = [];
    
    if (sheetArrays && Array.isArray(sheetArrays)) {
        // Dynamic scan of the first 30 rows of sheetArrays to locate the actual header row
        let detectedHeaderRowIndex = -1;
        let maxMatchesFound = -1;
        const headerScanLimit = Math.min(30, sheetArrays.length);
        
        for (let i = 0; i < headerScanLimit; i++) {
            const rowArr = sheetArrays[i] || [];
            const values = rowArr.map(v => String(v || '').trim().toLowerCase());
            let matches = 0;
            values.forEach(val => {
                if (val && targetHeaderKeywords.some(keyword => val === keyword || val.includes(keyword))) {
                    matches++;
                }
            });
            const hasSN = values.some(v => v === 's.n.' || v === 'sn' || v === 's. n.' || v === 's.n');
            const hasId = values.some(v => v.includes('applicant') || v.includes('applicant id') || v === 'id' || v.includes('form'));
            
            if (matches > maxMatchesFound && (hasSN || hasId || matches >= 4)) {
                maxMatchesFound = matches;
                detectedHeaderRowIndex = i;
            }
        }
        
        let headersList = [];
        let dataStartIndex = 0;
        
        if (detectedHeaderRowIndex !== -1) {
            console.log(`Dynamically discovered header row in Google Sheet arrays at index ${detectedHeaderRowIndex} with ${maxMatchesFound} matches.`);
            const rawHeaders = sheetArrays[detectedHeaderRowIndex] || [];
            headersList = rawHeaders.map((h, idx) => h && String(h).trim() ? String(h).trim() : `Column_${idx}`);
            dataStartIndex = detectedHeaderRowIndex + 1;
        } else {
            console.log(`Unable to locate header row dynamically in Google Sheet arrays. Falling back to default layout.`);
            headersList = ['S.N.', 'Applicant ID', 'Name', 'F/H Name', 'License No', 'Category', 'Code No', 'Office Visit Day', 'RECEIVED BY'];
            dataStartIndex = sheetArrays.length > 5 ? 5 : 0;
        }
        
        // Ensure index 8 (9th column, Column I) is always mapped specifically as 'RECEIVED BY'
        while (headersList.length <= 8) {
            headersList.push(`Column_${headersList.length}`);
        }
        headersList[8] = 'RECEIVED BY';
        
        originalHeadersList = headersList;
        
        for (let i = dataStartIndex; i < sheetArrays.length; i++) {
            const rowArr = sheetArrays[i] || [];
            if (rowArr.length === 0) continue;
            
            // Safely skip completely empty rows
            const hasAnyValue = rowArr.some(v => String(v || '').trim() !== '');
            if (!hasAnyValue) continue;
            
            const rowObj = {};
            for (let colIdx = 0; colIdx < headersList.length; colIdx++) {
                const headerName = headersList[colIdx];
                rowObj[headerName] = rowArr[colIdx] !== undefined ? String(rowArr[colIdx]).trim() : '';
            }
            rowObj.__rowIndex = i + refStartRow - 1;
            detectedRows.push(rowObj);
        }
        rows = detectedRows;
        headerRowIndex = detectedHeaderRowIndex !== -1 ? detectedHeaderRowIndex : (sheetArrays.length > 5 ? 4 : -1);
    }

    const headerRowScanLimit = rows ? Math.min(30, rows.length) : 0;


    let actualHeaderMap = {};
    let startIndex = 0;

    if (detectedRows.length > 0) {
        // Already processed using sheetArrays, so keys are already the original headers
        // and data rows start from index 0 of the rows array
        startIndex = 0;
    } else {
        for (let i = 0; i < headerRowScanLimit; i++) {
            const values = Object.values(rows[i] || {}).map(v => String(v).trim().toLowerCase());
            let matches = 0;
            values.forEach(val => {
                if (targetHeaderKeywords.some(keyword => val === keyword || val.includes(keyword))) {
                    matches++;
                }
            });
            
            // Ensure the header row contains at least one identifier marker to prevent choosing helper instructions
            const hasSN = values.some(v => v === 's.n.' || v === 'sn' || v === 's. n.' || v === 's.n');
            const hasId = values.some(v => v.includes('applicant') || v.includes('applicant id') || v === 'id' || v.includes('form'));
            
            if (matches > maxHeaderMatches && (hasSN || hasId || matches >= 4)) {
                maxHeaderMatches = matches;
                headerRowIndex = i;
            }
        }

        if (headerRowIndex !== -1 && rows[headerRowIndex]) {
            const headerRow = rows[headerRowIndex];
            for (const [k, v] of Object.entries(headerRow)) {
                if (v && k !== '__rowIndex') {
                    actualHeaderMap[k] = String(v).trim();
                }
            }
            console.log(`Detected Google Sheet data section starting at row ${headerRowIndex} (matched ${maxHeaderMatches} columns). Headers mapped:`, actualHeaderMap);
        }
        startIndex = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
    }

    // 2. Preprocess and clean up row properties using discovered headers
    const processedRows = [];
    
    for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        
        // Skip empty spacer or helper rows
        const hasAnyValue = Object.values(row).some(v => String(v).trim() !== '');
        if (!hasAnyValue) continue;
        
        const cleanRow = {};
        for (const k in row) {
            if (k === '__rowIndex') continue;
            const targetHeader = actualHeaderMap[k] || k;
            cleanRow[targetHeader] = String(row[k] || '').trim();
        }
        
        // Retain original row sheet index so we can update specific spreadsheets correctly
        cleanRow.__rowIndex = row.__rowIndex !== undefined ? row.__rowIndex : i;
        processedRows.push(cleanRow);
    }

    const rowCount = processedRows.length;

    // 3. Detect the correct standard header keys from the first processed row
    let nameKey = 'Name';
    let idKey = 'Applicant ID';
    let licenseKey = 'License No';
    let codeKey = 'Code No';
    let visitKey = 'Office Visit Day';
    let receivedKey = 'RECEIVED BY';
    let snKey = 'S.N.';
    let fhKey = 'F/H Name';
    let categoryKey = 'Category';

    if (rowCount > 0 && processedRows[0]) {
        const keys = Object.keys(processedRows[0]).filter(k => k !== '__rowIndex');
        
        const findBestKey = (possiblePatterns) => {
            // Priority 1: Exact case-insensitive match (with leading/trailing spaces trimmed)
            for (const pattern of possiblePatterns) {
                const match = keys.find(k => {
                    const normK = String(k).trim().toLowerCase();
                    const normP = pattern.toLowerCase();
                    return normK === normP;
                });
                if (match) return match;
            }
            // Priority 2: Ignore spaces, hyphens, underscores and symbols (safe for English & Devanagari/Unicode)
            const cleanString = (s) => String(s).trim().toLowerCase().replace(/[\s\-_,\(\)\.\:\/\&\?]/g, '');
            for (const pattern of possiblePatterns) {
                const cleanP = cleanString(pattern);
                if (!cleanP) continue; // Safety Guard: prevent empty-clean pattern matches
                const match = keys.find(k => cleanString(k) === cleanP);
                if (match) return match;
            }
            // Priority 3: Substring match check
            for (const pattern of possiblePatterns) {
                const cleanP = cleanString(pattern);
                if (!cleanP) continue; // Safety Guard: prevent empty-clean pattern substring matches
                const match = keys.find(k => {
                    const cleanK = cleanString(k);
                    return cleanK.includes(cleanP) || cleanP.includes(cleanK);
                });
                if (match) return match;
            }
            return null;
        };

        nameKey = findBestKey(['Name', 'Full Legal Name', 'Full Name', 'Full_Name', 'FullName', 'नेम', 'नाम', 'आवेदकको नाम', 'सवारी धनीको नाम', 'Applicant Name', 'ApplicantName']) || 'Name';
        idKey = findBestKey(['Applicant ID', 'ApplicantID', 'Form ID', 'Form No', 'FormNo', 'Registration ID', 'Reg ID', 'ID', 'Reference No', 'Ref No', 'आवेदक नम्बर', 'दर्ता नं', 'संकेत नं', 'Applicant_ID']) || 'Applicant ID';
        licenseKey = findBestKey(['License No', 'License Number', 'LicenseNo', 'Licence', 'License', 'LicenseNo.', 'लाइसेन्स', 'लाइसेन्स नं', 'लाइसेन्स नम्बर', 'सवारी चालक अनुमति पत्र नं.', 'License_No']) || 'License No';
        codeKey = findBestKey(['Code No', 'CodeNo', 'Access Code', 'Code', 'Code No.', 'कोड', 'कोड नं', 'Code_No']) || 'Code No';
        visitKey = findBestKey(['Office Visit Day', 'Visit Day', 'Scheduled Appointment', 'Office Visit', 'Visit Date', 'Appointment', 'Day', 'भ्रमण दिन', 'भ्रमण मिति', 'Office_Visit_Day']) || 'Office Visit Day';
        receivedKey = 'RECEIVED BY';
        snKey = findBestKey(['S.N.', 'S.N', 'S. N.', 'Serial No', 'SN', 'सि.नं.']) || 'S.N.';
        
        // Dynamic additions for Father/Husband Name and Category
        fhKey = findBestKey(['F/H Name', 'Father/Husband Name', 'F/H NAME', 'fh_name', 'f_h_name', 'Father Name', 'Husband Name', 'F/H NAME/HUSBAND', 'पिता/पतिको नाम', 'पिताको नाम', 'पतिको नाम', 'F/H_Name']) || 'F/H Name';
        categoryKey = findBestKey(['Category', 'CATEGORY', 'class', 'CLASS', 'License Category', 'License Class', 'वर्ग', 'वर्ग (लाइसेन्स)', 'Cat', 'CAT', 'लाइसेन्स वर्ग']) || 'Category';
    }

    const standardizedRows = [];

    for (let i = 0; i < rowCount; i++) {
        const row = processedRows[i];
        
        // Build standardized row structure so the app is guaranteed to find standard fields
        const stdRow = {
            'S.N.': row[snKey] !== undefined ? String(row[snKey]).trim() : '',
            'Name': row[nameKey] !== undefined ? String(row[nameKey]).trim() : '',
            'Applicant ID': row[idKey] !== undefined ? String(row[idKey]).trim() : '',
            'License No': row[licenseKey] !== undefined ? String(row[licenseKey]).trim() : '',
            'F/H Name': fhKey && row[fhKey] !== undefined ? String(row[fhKey]).trim() : '',
            'Category': categoryKey && row[categoryKey] !== undefined ? String(row[categoryKey]).trim() : '',
            'Code No': row[codeKey] !== undefined ? String(row[codeKey]).trim() : '',
            'Office Visit Day': row[visitKey] !== undefined ? String(row[visitKey]).trim() : '',
            'RECEIVED BY': row[receivedKey] !== undefined ? String(row[receivedKey]).trim() : '',
            '__rowIndex': row.__rowIndex !== undefined ? row.__rowIndex : i
        };

        // Also carry over original keys so we don't lose any other sheet columns
        for (const k in row) {
            if (k !== '__rowIndex' && stdRow[k] === undefined) {
                stdRow[k] = row[k];
            }
        }

        const rawName = stdRow['Name'].toLowerCase();
        const rawId = stdRow['Applicant ID'].toLowerCase();
        const rawLicense = stdRow['License No'].toLowerCase();

        if (rawName && !nameMap.has(rawName)) nameMap.set(rawName, stdRow);
        if (rawId && !idMap.has(rawId)) idMap.set(rawId, stdRow);
        if (rawLicense && !licenseMap.has(rawLicense)) licenseMap.set(rawLicense, stdRow);
        
        standardizedRows.push(stdRow);

        if (i % 20000 === 0 && i > 0) {
            self.postMessage({ type: 'PROGRESS', percent: Math.round((i / rowCount) * 100) });
        }
    }

    self.postMessage({ 
        type: 'COMPLETE', 
        count: rowCount, 
        isFreshSheet: !isAlreadyStandardized,
        maps: { nameMap, idMap, licenseMap },
        rows: shouldReturnRows ? standardizedRows : null,
        headers: originalHeadersList.length > 0 ? originalHeadersList : (rowCount > 0 && standardizedRows[0] ? Object.keys(standardizedRows[0]).filter(k => k !== '__rowIndex') : [])
    });
}
