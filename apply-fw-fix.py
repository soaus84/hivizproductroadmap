#!/usr/bin/env python3
"""
Quick fix for taxonomy.html — repairs broken FW result rendering.
Run from repo root: python3 apply-fw-fix.py
"""
import os, sys, shutil

TARGET = 'taxonomy.html'
if not os.path.exists(TARGET):
    print(f"ERROR: {TARGET} not found. Run from repo root.")
    sys.exit(1)

content = open(TARGET).read()

BROKEN = "    populateResult('fw_factor', result.fw_factor?.replace(/_/g,' '), result.fw_confidence, result.fw_rationale);\n    populateResult('fw_domain', result.fw_domain?.toUpperCase(), null, null);\n    populateResult('fw_maturity', result.fw_maturity_signal, null, null);\n    populateResult('routing', result.pipeline_routing?.replace(/_/g,' '), null, result.routing_rationale);\n\n    // Highlight in taxonomy\n    highlightTaxonomy('signal_type', result.signal_type);\n    highlightTaxonomy('fw_factor', result.fw_factor);\n    highlightTaxonomy('barrier', result.barrier_assessment);"

if BROKEN not in content:
    print("Broken block not found — may already be fixed, or file differs.")
    sys.exit(1)

FIXED = r"""    populateResult('routing', result.pipeline_routing?.replace(/_/g,' '), null, result.routing_rationale);

    // FW Map® — render classifications array (Blueprint-enriched v0.2)
    const fwCard = document.getElementById('res-fw_factor');
    fwCard.classList.add('populated');
    const fwValEl = fwCard.querySelector('.result-value');
    fwValEl.textContent = '';
    fwValEl.className = 'result-value';

    if (result.fw_classifications && result.fw_classifications.length > 0) {
      result.fw_classifications.forEach((cls, i) => {
        const factorEl = document.createElement('div');
        factorEl.style.cssText = i > 0 ? 'margin-top:10px;padding-top:10px;border-top:1px solid var(--border-light);' : '';
        const confColor = cls.fw_confidence >= 0.7 ? 'var(--green)' : cls.fw_confidence >= 0.5 ? 'var(--amber)' : 'var(--red)';
        factorEl.innerHTML = `
          <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:var(--text-primary);">${cls.fw_factor?.replace(/_/g,' ')}</div>
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">${cls.fw_domain?.toUpperCase()} · ${cls.fw_maturity_signal}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <div style="flex:1;height:3px;background:var(--border);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${cls.fw_confidence*100}%;border-radius:2px;background:${confColor}"></div>
            </div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);">${(cls.fw_confidence*100).toFixed(0)}%</div>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);font-style:italic;line-height:1.45;">${cls.fw_rationale}</div>
        `;
        fwValEl.appendChild(factorEl);
        highlightTaxonomy('fw_factor', cls.fw_factor);
      });
      if (result.fw_classification_basis) {
        const basisEl = document.createElement('div');
        basisEl.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid var(--border-light);font-size:10px;color:var(--text-muted);font-style:italic;';
        basisEl.textContent = result.fw_classification_basis;
        fwValEl.appendChild(basisEl);
      }
    } else {
      fwValEl.textContent = result.fw_attempted === false ? 'Input too thin to classify' : 'No factor met 0.70 threshold';
      fwValEl.className = 'result-value c-muted';
    }

    // Hide separate domain/maturity cards — shown inline per factor above
    const domCard = document.getElementById('res-fw_domain');
    const matCard = document.getElementById('res-fw_maturity');
    if (domCard) domCard.style.display = 'none';
    if (matCard) matCard.style.display = 'none';

    // Highlight in taxonomy
    highlightTaxonomy('signal_type', result.signal_type);
    highlightTaxonomy('barrier', result.barrier_assessment);"""

shutil.copy(TARGET, TARGET + '.bak')
content = content.replace(BROKEN, FIXED, 1)
open(TARGET, 'w').write(content)
print(f"✓ Fixed taxonomy.html ({len(content)} bytes). Backup: {TARGET}.bak")
print("\ngit add taxonomy.html")
print('git commit -m "fix: repair FW Map® result rendering for classifications array"')
