# Evaluation Run #001

**Date:** 2025-07-23  
**Messages:** 40 Discord messages from technology-trends channel  
**Duration:** July 21-22, 2025 (~18 hours)  

## Test Configuration
- **Pipeline:** Multi-pass newspaper generation (4 passes)
- **Model:** gpt-4o-mini
- **Evaluation:** O3 model fact-checking
- **Sample:** channel-messages-sample.txt (40 messages)

## Key Issues Identified

### Summary Statistics
- **Total Issues Found:** 4
- **Medium Severity:** 2 (wrong attributions)  
- **Low Severity:** 2 (missing links, emotional embellishment)

### Specific Problems

1. **Hallucinated Links (Medium)**
   - Added fake `moonshot.com` URL not in input
   - Added fake `example.com` URL for Lite LLM
   
2. **Missing Critical Content (High - not in O3 eval)**
   - swyxio YouTube link missing from Community Highlights
   - Real URLs not preserved in Resources section

3. **Emotional Embellishment (Low)**
   - Added "stunned community" language where input was casual

4. **Resource Preservation Issues (Low)**
   - Empty parentheses in Resources section instead of actual URLs

## Root Causes
- Multi-pass processing losing context between passes
- AI hallucinating content instead of accurately reporting
- Catchall/Community Highlights not capturing isolated mentions
- Post-processing URL deduplication too aggressive

## Files Generated
- `001-messages.txt` - Input Discord messages
- `001-prompts.js` - Static prompts used  
- `001-result.txt` - Complete pipeline output with debug info
- `001-evaluation.json` - O3 fact-check analysis
- `001-summary.md` - This summary

## Next Steps
- Fix Community Highlights prompt to capture isolated mentions
- Improve resource preservation across passes
- Remove fake URL generation
- Test with refined prompts