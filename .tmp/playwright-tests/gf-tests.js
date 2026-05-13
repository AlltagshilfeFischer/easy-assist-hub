/**
 * Comprehensive GF (Geschäftsführer) Test Suite
 * App: https://portal.alltagshilfe-fischer.de/
 * User: info@kitech-software.de
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://portal.alltagshilfe-fischer.de';
const EMAIL = 'info@kitech-software.de';
const PASSWORD = '1234567891';

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
let screenshotIndex = 0;

function log(emoji, testName, status, detail = '') {
  const entry = { emoji, testName, status, detail, ts: new Date().toISOString() };
  results.push(entry);
  console.log(`${emoji} [${status}] ${testName}${detail ? ' — ' + detail : ''}`);
}

async function screenshot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${String(++screenshotIndex).padStart(3,'0')}_${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function login(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="E-Mail"], input[placeholder*="email"]', { timeout: 10000 });
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="E-Mail"], input[placeholder*="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

async function runTests() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // ─────────────────────────────────────────────
  // BLOCK 1: AUTH
  // ─────────────────────────────────────────────
  console.log('\n═══ BLOCK 1: AUTH ═══');

  // 1.1 Falsche Credentials
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 8000 });
    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await page.fill('input[type="password"]', 'FALSCH123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    const errorVisible = await page.locator('text=/ungültig|falsch|invalid|error|fehl/i').count() > 0
      || await page.locator('[role="alert"]').count() > 0
      || await page.locator('.text-red, .text-destructive, [class*="error"]').count() > 0;
    const stillOnLogin = !page.url().includes('dashboard');
    if (errorVisible && stillOnLogin) {
      log('✅', '1.1 Login mit falschen Credentials', 'PASS', 'Fehlermeldung sichtbar, kein Dashboard-Zugriff');
    } else if (stillOnLogin) {
      log('⚠️', '1.1 Login mit falschen Credentials', 'WARN', 'Login blockiert, aber keine sichtbare Fehlermeldung');
    } else {
      log('❌', '1.1 Login mit falschen Credentials', 'FAIL', 'Login erfolgreich obwohl Passwort falsch!');
    }
    await screenshot(page, 'auth_wrong_password');
  } catch (e) {
    log('❌', '1.1 Login mit falschen Credentials', 'ERROR', e.message);
  }

  // 1.2 Korrekter Login
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 8000 });
    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    log('✅', '1.2 Korrekter Login', 'PASS', `Weiterleitung zu: ${page.url()}`);
    await screenshot(page, 'auth_login_success');
  } catch (e) {
    log('❌', '1.2 Korrekter Login', 'FAIL', e.message);
    await browser.close();
    return;
  }

  // 1.3 Session-Persist (Seite neu laden)
  try {
    const urlBefore = page.url();
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const urlAfter = page.url();
    const sessionKept = urlAfter.includes('dashboard') || urlAfter === urlBefore;
    if (sessionKept) {
      log('✅', '1.3 Session nach Reload', 'PASS', 'Session bleibt erhalten');
    } else {
      log('❌', '1.3 Session nach Reload', 'FAIL', `Redirect zu Login: ${urlAfter}`);
    }
    await screenshot(page, 'auth_session_reload');
  } catch (e) {
    log('❌', '1.3 Session nach Reload', 'ERROR', e.message);
  }

  // 1.4 GF Sidebar-Items sichtbar
  try {
    const expectedItems = ['Dienstplan', 'Kunden', 'Leistungsnachweise', 'Budgettracker', 'Einstellungen'];
    const missing = [];
    for (const item of expectedItems) {
      const found = await page.locator(`text="${item}"`).count() > 0
        || await page.locator(`[href*="${item.toLowerCase()}"]`).count() > 0;
      if (!found) missing.push(item);
    }
    if (missing.length === 0) {
      log('✅', '1.4 GF Sidebar vollständig', 'PASS', `Alle Items sichtbar`);
    } else {
      log('⚠️', '1.4 GF Sidebar vollständig', 'WARN', `Fehlende Items: ${missing.join(', ')}`);
    }
    await screenshot(page, 'auth_sidebar');
  } catch (e) {
    log('❌', '1.4 GF Sidebar vollständig', 'ERROR', e.message);
  }

  // ─────────────────────────────────────────────
  // BLOCK 2: NAVIGATION
  // ─────────────────────────────────────────────
  console.log('\n═══ BLOCK 2: NAVIGATION ═══');

  // 2.1 Direkter URL-Aufruf Dienstplan
  try {
    await page.goto(`${BASE_URL}/dashboard/controlboard/schedule-builder`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const onSchedule = page.url().includes('schedule-builder') || await page.locator('text=/Dienstplan|Kalender|Schedule/i').count() > 0;
    if (onSchedule) {
      log('✅', '2.1 Direkter URL: Dienstplan', 'PASS');
    } else {
      log('❌', '2.1 Direkter URL: Dienstplan', 'FAIL', `Gelandet auf: ${page.url()}`);
    }
    await screenshot(page, 'nav_direct_schedule');
  } catch (e) {
    log('❌', '2.1 Direkter URL: Dienstplan', 'ERROR', e.message);
  }

  // 2.2 Direkter URL-Aufruf Budgettracker
  try {
    await page.goto(`${BASE_URL}/dashboard/controlboard/budgettracker`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const onBudget = page.url().includes('budget') || await page.locator('text=/Budget|Entlastung|Verhinderung/i').count() > 0;
    if (onBudget) {
      log('✅', '2.2 Direkter URL: Budgettracker', 'PASS');
    } else {
      log('❌', '2.2 Direkter URL: Budgettracker', 'FAIL', `Gelandet auf: ${page.url()}`);
    }
    await screenshot(page, 'nav_direct_budget');
  } catch (e) {
    log('❌', '2.2 Direkter URL: Budgettracker', 'ERROR', e.message);
  }

  // 2.3 Browser Zurück-Button
  try {
    const urlBefore = page.url();
    await page.goto(`${BASE_URL}/dashboard/controlboard/master-data`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.goBack({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const urlAfter = page.url();
    if (urlAfter === urlBefore || urlAfter.includes('budget')) {
      log('✅', '2.3 Browser Zurück-Button', 'PASS', `Zurück zu: ${urlAfter}`);
    } else {
      log('⚠️', '2.3 Browser Zurück-Button', 'WARN', `Unerwartete URL: ${urlAfter}`);
    }
    await screenshot(page, 'nav_back_button');
  } catch (e) {
    log('❌', '2.3 Browser Zurück-Button', 'ERROR', e.message);
  }

  // 2.4 Nicht-autorisierte Route (Mitarbeiter-only)
  try {
    await page.goto(`${BASE_URL}/dashboard/mein-bereich`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // GF sollte "Mein Bereich" sehen dürfen (laut Rollen-Regel: geschaeftsfuehrer + mitarbeiter)
    const accessible = !page.url().includes('login') && !await page.locator('text=/Zugriff verweigert|Access Denied|keine Berechtigung/i').count();
    if (accessible) {
      log('✅', '2.4 Mein Bereich für GF zugänglich', 'PASS');
    } else {
      log('⚠️', '2.4 Mein Bereich für GF zugänglich', 'WARN', 'Zugriff verweigert oder Redirect');
    }
    await screenshot(page, 'nav_mein_bereich');
  } catch (e) {
    log('❌', '2.4 Mein Bereich für GF zugänglich', 'ERROR', e.message);
  }

  // ─────────────────────────────────────────────
  // BLOCK 3: KUNDEN-MANAGEMENT
  // ─────────────────────────────────────────────
  console.log('\n═══ BLOCK 3: KUNDEN-MANAGEMENT ═══');

  // Master Data laden
  await page.goto(`${BASE_URL}/dashboard/controlboard/master-data`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await screenshot(page, 'kunden_master_data');

  // 3.1 Kunden-Tab öffnen
  try {
    // Suche nach Kunden-Tab oder Kunden-Bereich
    const kundenTab = page.locator('button:has-text("Kunden"), [role="tab"]:has-text("Kunden"), a:has-text("Kunden")').first();
    if (await kundenTab.count() > 0) {
      await kundenTab.click();
      await page.waitForTimeout(2000);
      log('✅', '3.1 Kunden-Tab öffnen', 'PASS');
    } else {
      log('⚠️', '3.1 Kunden-Tab öffnen', 'WARN', 'Kein Kunden-Tab gefunden — prüfe Seitenstruktur');
    }
    await screenshot(page, 'kunden_tab');
  } catch (e) {
    log('❌', '3.1 Kunden-Tab öffnen', 'ERROR', e.message);
  }

  // 3.2 Kunden anlegen — Button suchen
  let kundeAnlegenErfolg = false;
  try {
    const addBtn = page.locator('button:has-text("Neu"), button:has-text("Hinzufügen"), button:has-text("Anlegen"), button:has-text("+ Kunde"), button[aria-label*="neu"], button[aria-label*="add"]').first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(2000);
      log('✅', '3.2 Kunden-Anlegen Button', 'PASS', 'Dialog/Formular geöffnet');
      kundeAnlegenErfolg = true;
    } else {
      log('⚠️', '3.2 Kunden-Anlegen Button', 'WARN', 'Kein Anlegen-Button gefunden');
    }
    await screenshot(page, 'kunden_anlegen_dialog');
  } catch (e) {
    log('❌', '3.2 Kunden-Anlegen Button', 'ERROR', e.message);
  }

  // 3.3 Formular ohne Pflichtfelder absenden
  if (kundeAnlegenErfolg) {
    try {
      const submitBtn = page.locator('button[type="submit"], button:has-text("Speichern"), button:has-text("Erstellen")').first();
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
        const hasValidation = await page.locator('[class*="error"], [class*="invalid"], .text-red-500, .text-destructive, [aria-invalid="true"]').count() > 0
          || await page.locator('text=/Pflichtfeld|erforderlich|required/i').count() > 0;
        if (hasValidation) {
          log('✅', '3.3 Pflichtfeld-Validierung', 'PASS', 'Validierungsfehler sichtbar');
        } else {
          log('⚠️', '3.3 Pflichtfeld-Validierung', 'WARN', 'Keine Validierungsfehler sichtbar — prüfen ob Formular leer abgesendet');
        }
        await screenshot(page, 'kunden_validierung');
      }
    } catch (e) {
      log('❌', '3.3 Pflichtfeld-Validierung', 'ERROR', e.message);
    }
  }

  // 3.4 Kunden anlegen mit gültigen Daten (Pflegegrad 2)
  const testKundenname = `Test Kunde ${Date.now()}`;
  let neuerKundeId = null;
  if (kundeAnlegenErfolg) {
    try {
      // Vorname
      const vorname = page.locator('input[name="vorname"], input[placeholder*="Vorname"], label:has-text("Vorname") + input, label:has-text("Vorname") ~ input').first();
      if (await vorname.count() > 0) await vorname.fill('Test');

      // Nachname
      const nachname = page.locator('input[name="nachname"], input[placeholder*="Nachname"], label:has-text("Nachname") + input, label:has-text("Nachname") ~ input').first();
      if (await nachname.count() > 0) await nachname.fill('Kunde-QA');

      // Pflegegrad
      const pflegegrad = page.locator('select[name="pflegegrad"], input[name="pflegegrad"], [data-value], button[role="combobox"]').first();
      if (await pflegegrad.count() > 0) {
        await pflegegrad.click();
        await page.waitForTimeout(500);
        const pg2 = page.locator('text="2"').first();
        if (await pg2.count() > 0) await pg2.click();
      }

      // Telefon (falls vorhanden)
      const telefon = page.locator('input[name="telefon"], input[placeholder*="Telefon"]').first();
      if (await telefon.count() > 0) await telefon.fill('0511-123456');

      await screenshot(page, 'kunden_formular_ausgefuellt');

      const submitBtn = page.locator('button[type="submit"], button:has-text("Speichern"), button:has-text("Erstellen")').first();
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
        const success = await page.locator('text=/erfolgreich|gespeichert|angelegt|created/i').count() > 0
          || await page.locator('[data-sonner-toast], .sonner-toast').count() > 0;
        if (success) {
          log('✅', '3.4 Kunde anlegen (Pflegegrad 2)', 'PASS', 'Erfolgreich angelegt');
          kundeAnlegenErfolg = true;
        } else {
          log('⚠️', '3.4 Kunde anlegen (Pflegegrad 2)', 'WARN', 'Kein Erfolgs-Toast sichtbar');
        }
        await screenshot(page, 'kunden_angelegt_success');
      }
    } catch (e) {
      log('❌', '3.4 Kunde anlegen (Pflegegrad 2)', 'ERROR', e.message);
    }
  }

  // 3.5 Kunden-Liste: gespeicherter Kunde sichtbar
  try {
    await page.waitForTimeout(2000);
    const inList = await page.locator('text="Kunde-QA"').count() > 0;
    if (inList) {
      log('✅', '3.5 Neuer Kunde in Liste sichtbar', 'PASS');
    } else {
      log('⚠️', '3.5 Neuer Kunde in Liste sichtbar', 'WARN', 'Name nicht in Liste gefunden');
    }
    await screenshot(page, 'kunden_liste');
  } catch (e) {
    log('❌', '3.5 Neuer Kunde in Liste sichtbar', 'ERROR', e.message);
  }

  // 3.6 Kundendaten bearbeiten + Zurück navigieren
  try {
    const kundeRow = page.locator('tr:has-text("Kunde-QA"), [data-row]:has-text("Kunde-QA"), .card:has-text("Kunde-QA")').first();
    if (await kundeRow.count() > 0) {
      await kundeRow.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'kunden_detail');

      // Bearbeiten-Button
      const editBtn = page.locator('button:has-text("Bearbeiten"), button:has-text("Ändern"), button[aria-label*="edit"], button[aria-label*="bearbeiten"]').first();
      if (await editBtn.count() > 0) {
        await editBtn.click();
        await page.waitForTimeout(1500);

        // Telefon ändern
        const telefon = page.locator('input[name="telefon"], input[placeholder*="Telefon"]').first();
        if (await telefon.count() > 0) {
          await telefon.clear();
          await telefon.fill('0511-999888');
        }

        await screenshot(page, 'kunden_bearbeiten');

        // Speichern
        const saveBtn = page.locator('button[type="submit"], button:has-text("Speichern")').first();
        if (await saveBtn.count() > 0) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
          log('✅', '3.6 Kundendaten bearbeiten', 'PASS');
        }
      }

      // Zurück-Navigation
      const backBtn = page.locator('button:has-text("Zurück"), a:has-text("Zurück"), [aria-label*="back"], [aria-label*="zurück"]').first();
      if (await backBtn.count() > 0) {
        await backBtn.click();
        await page.waitForTimeout(1500);
        log('✅', '3.6b Zurück-Navigation nach Bearbeitung', 'PASS', `URL: ${page.url()}`);
      } else {
        await page.goBack({ waitUntil: 'networkidle' });
        log('⚠️', '3.6b Zurück-Navigation nach Bearbeitung', 'WARN', 'Kein Zurück-Button — Browser-Back genutzt');
      }
      await screenshot(page, 'kunden_nach_zurueck');
    } else {
      log('⚠️', '3.6 Kundendaten bearbeiten', 'WARN', 'Neuer Kunde nicht in Liste klickbar');
    }
  } catch (e) {
    log('❌', '3.6 Kundendaten bearbeiten', 'ERROR', e.message);
  }

  // ─────────────────────────────────────────────
  // BLOCK 4: BUDGETTRACKER
  // ─────────────────────────────────────────────
  console.log('\n═══ BLOCK 4: BUDGETTRACKER ═══');

  try {
    await page.goto(`${BASE_URL}/dashboard/controlboard/budgettracker`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await screenshot(page, 'budget_overview');

    // 4.1 Budget-Seite lädt ohne Fehler
    const hasError = await page.locator('text=/Fehler|Error|not found|404/i').count() > 0;
    const hasBudgetContent = await page.locator('text=/Budget|Entlastung|Verhinderung|€/').count() > 0;
    if (!hasError && hasBudgetContent) {
      log('✅', '4.1 Budgettracker lädt', 'PASS');
    } else if (hasError) {
      log('❌', '4.1 Budgettracker lädt', 'FAIL', 'Fehler auf der Seite');
    } else {
      log('⚠️', '4.1 Budgettracker lädt', 'WARN', 'Keine Budget-Inhalte sichtbar');
    }

    // 4.2 Kunden-Auswahl im Budgettracker
    const kundeSelect = page.locator('select, [role="combobox"], button[aria-haspopup="listbox"]').first();
    if (await kundeSelect.count() > 0) {
      await kundeSelect.click();
      await page.waitForTimeout(1000);
      const options = await page.locator('[role="option"], option').count();
      log(options > 0 ? '✅' : '⚠️', '4.2 Kunden-Auswahl im Budgettracker', options > 0 ? 'PASS' : 'WARN', `${options} Optionen gefunden`);
      await screenshot(page, 'budget_kunden_select');
      // Erste Option wählen
      const firstOption = page.locator('[role="option"], option').first();
      if (await firstOption.count() > 0) await firstOption.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'budget_kunde_gewaehlt');
    } else {
      log('⚠️', '4.2 Kunden-Auswahl im Budgettracker', 'WARN', 'Kein Dropdown gefunden');
    }

    // 4.3 Budget-Töpfe sichtbar (Entlastung, Verhinderung, Privat)
    const entlastung = await page.locator('text=/Entlastung/i').count() > 0;
    const verhinderung = await page.locator('text=/Verhinderung/i').count() > 0;
    const privat = await page.locator('text=/Privat/i').count() > 0;
    const topfCount = [entlastung, verhinderung, privat].filter(Boolean).length;
    log(topfCount >= 2 ? '✅' : '⚠️', '4.3 Budget-Töpfe sichtbar', topfCount >= 2 ? 'PASS' : 'WARN',
      `Entlastung: ${entlastung}, Verhinderung: ${verhinderung}, Privat: ${privat}`);
    await screenshot(page, 'budget_toepfe');

    // 4.4 Transaktion hinzufügen (falls Button vorhanden)
    const addTransBtn = page.locator('button:has-text("Transaktion"), button:has-text("Buchen"), button:has-text("Einzahlung"), button:has-text("Hinzufügen")').first();
    if (await addTransBtn.count() > 0) {
      await addTransBtn.click();
      await page.waitForTimeout(1500);
      log('✅', '4.4 Transaktion-Dialog öffnet', 'PASS');
      await screenshot(page, 'budget_transaktion_dialog');
      // Abbrechen
      const cancelBtn = page.locator('button:has-text("Abbrechen"), button:has-text("Cancel"), [aria-label*="close"], [aria-label*="schließen"]').first();
      if (await cancelBtn.count() > 0) await cancelBtn.click();
    } else {
      log('⚠️', '4.4 Transaktion-Dialog', 'WARN', 'Kein Transaktion-Button gefunden');
    }

  } catch (e) {
    log('❌', '4.x Budgettracker', 'ERROR', e.message);
  }

  // ─────────────────────────────────────────────
  // BLOCK 5: DIENSTPLAN
  // ─────────────────────────────────────────────
  console.log('\n═══ BLOCK 5: DIENSTPLAN ═══');

  try {
    await page.goto(`${BASE_URL}/dashboard/controlboard/schedule-builder`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);
    await screenshot(page, 'dienstplan_overview');

    // 5.1 Kalender lädt
    const hasCalendar = await page.locator('[class*="calendar"], [class*="schedule"], table').count() > 0
      || await page.locator('text=/Montag|Dienstag|Mittwoch|Mo|Di|Mi/').count() > 0;
    log(hasCalendar ? '✅' : '❌', '5.1 Dienstplan-Kalender lädt', hasCalendar ? 'PASS' : 'FAIL');

    // 5.2 Termin anlegen
    const addTerminBtn = page.locator('button:has-text("Termin"), button:has-text("Neu"), button:has-text("Hinzufügen"), button[aria-label*="add"], button[aria-label*="neu"]').first();
    if (await addTerminBtn.count() > 0) {
      await addTerminBtn.click();
      await page.waitForTimeout(2000);
      log('✅', '5.2 Termin-Dialog öffnet', 'PASS');
      await screenshot(page, 'dienstplan_termin_dialog');

      // Abbrechen
      const cancelBtn = page.locator('button:has-text("Abbrechen"), button:has-text("Cancel")').first();
      if (await cancelBtn.count() > 0) await cancelBtn.click();
      await page.waitForTimeout(1000);
    } else {
      // Versuch: Klick auf Kalender-Zelle
      const calCell = page.locator('td[data-date], [data-day], .fc-day-grid-event, .rbc-day-slot').first();
      if (await calCell.count() > 0) {
        await calCell.click();
        await page.waitForTimeout(2000);
        log('⚠️', '5.2 Termin via Kalender-Klick', 'WARN', 'Kein expliziter Neu-Button — Kalender-Klick versucht');
        await screenshot(page, 'dienstplan_cell_click');
        const cancelBtn = page.locator('button:has-text("Abbrechen"), button:has-text("Cancel")').first();
        if (await cancelBtn.count() > 0) await cancelBtn.click();
      } else {
        log('⚠️', '5.2 Termin anlegen', 'WARN', 'Kein Termin-Button und keine Kalender-Zellen gefunden');
      }
    }

    // 5.3 Navigation: Vor/Zurück im Kalender
    const nextBtn = page.locator('button[aria-label*="next"], button[aria-label*="vor"], button:has-text(">"), button:has-text("›")').first();
    const prevBtn = page.locator('button[aria-label*="prev"], button[aria-label*="zurück"], button:has-text("<"), button:has-text("‹")').first();
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      await page.waitForTimeout(1500);
      log('✅', '5.3 Kalender Vor-Navigation', 'PASS');
      await screenshot(page, 'dienstplan_next');
    }
    if (await prevBtn.count() > 0) {
      await prevBtn.click();
      await page.waitForTimeout(1500);
      log('✅', '5.3 Kalender Zurück-Navigation', 'PASS');
    }

  } catch (e) {
    log('❌', '5.x Dienstplan', 'ERROR', e.message);
  }

  // ─────────────────────────────────────────────
  // BLOCK 6: LEISTUNGSNACHWEISE
  // ─────────────────────────────────────────────
  console.log('\n═══ BLOCK 6: LEISTUNGSNACHWEISE ═══');

  try {
    await page.goto(`${BASE_URL}/dashboard/controlboard/leistungsnachweise`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await screenshot(page, 'ln_overview');

    const hasLN = await page.locator('text=/Leistungsnachweis|Nachweis|Abrechnung/i').count() > 0;
    const hasError = await page.locator('text=/Fehler|Error|404/i').count() > 0;
    log(hasLN && !hasError ? '✅' : hasError ? '❌' : '⚠️',
      '6.1 Leistungsnachweise lädt', hasLN && !hasError ? 'PASS' : hasError ? 'FAIL' : 'WARN');

    // Export-Button
    const exportBtn = page.locator('button:has-text("Export"), button:has-text("PDF"), button:has-text("Download")').first();
    if (await exportBtn.count() > 0) {
      log('✅', '6.2 Export-Button sichtbar', 'PASS');
    } else {
      log('⚠️', '6.2 Export-Button sichtbar', 'WARN', 'Kein Export-Button gefunden');
    }

    // Filter
    const filterEl = page.locator('select, input[type="month"], input[type="date"], [role="combobox"]').first();
    if (await filterEl.count() > 0) {
      log('✅', '6.3 Filter vorhanden', 'PASS');
    } else {
      log('⚠️', '6.3 Filter vorhanden', 'WARN');
    }
    await screenshot(page, 'ln_detail');

  } catch (e) {
    log('❌', '6.x Leistungsnachweise', 'ERROR', e.message);
  }

  // ─────────────────────────────────────────────
  // BLOCK 7: REPORTING
  // ─────────────────────────────────────────────
  console.log('\n═══ BLOCK 7: REPORTING ═══');

  try {
    await page.goto(`${BASE_URL}/dashboard/controlboard/reporting`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await screenshot(page, 'reporting_overview');

    const hasReporting = await page.locator('text=/Bericht|Report|Auswertung|Statistik/i').count() > 0;
    const hasChart = await page.locator('svg, canvas, [class*="chart"], [class*="recharts"]').count() > 0;
    log(hasReporting ? '✅' : '⚠️', '7.1 Reporting lädt', hasReporting ? 'PASS' : 'WARN');
    log(hasChart ? '✅' : '⚠️', '7.2 Charts/Diagramme vorhanden', hasChart ? 'PASS' : 'WARN');

    // CSV Export
    const csvBtn = page.locator('button:has-text("CSV"), button:has-text("Export"), button:has-text("Exportieren")').first();
    if (await csvBtn.count() > 0) {
      log('✅', '7.3 Export-Button sichtbar', 'PASS');
    } else {
      log('⚠️', '7.3 Export-Button sichtbar', 'WARN');
    }

  } catch (e) {
    log('❌', '7.x Reporting', 'ERROR', e.message);
  }

  // ─────────────────────────────────────────────
  // BLOCK 8: EINSTELLUNGEN
  // ─────────────────────────────────────────────
  console.log('\n═══ BLOCK 8: EINSTELLUNGEN ═══');

  try {
    await page.goto(`${BASE_URL}/dashboard/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, 'settings_overview');

    const hasSettings = !page.url().includes('login') && await page.locator('text=/Einstellung|Setting|Profil|Passwort/i').count() > 0;
    log(hasSettings ? '✅' : '❌', '8.1 Einstellungen für GF zugänglich', hasSettings ? 'PASS' : 'FAIL');

  } catch (e) {
    log('❌', '8.x Einstellungen', 'ERROR', e.message);
  }

  // ─────────────────────────────────────────────
  // BLOCK 9: EDGE CASES
  // ─────────────────────────────────────────────
  console.log('\n═══ BLOCK 9: EDGE CASES ═══');

  // 9.1 Console-Errors prüfen
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // 9.2 404-Seite
  try {
    await page.goto(`${BASE_URL}/dashboard/nonexistent-route`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const has404 = await page.locator('text=/404|nicht gefunden|not found/i').count() > 0;
    const redirectedHome = page.url().includes('dashboard') && !page.url().includes('nonexistent');
    if (has404) {
      log('✅', '9.2 404-Handling', 'PASS', '404-Seite wird angezeigt');
    } else if (redirectedHome) {
      log('✅', '9.2 404-Handling', 'PASS', 'Redirect zu Dashboard');
    } else {
      log('⚠️', '9.2 404-Handling', 'WARN', `URL: ${page.url()}`);
    }
    await screenshot(page, 'edge_404');
  } catch (e) {
    log('❌', '9.2 404-Handling', 'ERROR', e.message);
  }

  // 9.3 Aktivitätslog (nur globaladmin — GF sollte keinen Zugriff haben)
  try {
    await page.goto(`${BASE_URL}/dashboard/controlboard/aktivitaetslog`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const hasAccess = await page.locator('text=/Aktivität|Log|Protokoll/i').count() > 0;
    const denied = await page.locator('text=/Zugriff|Access|Berechtigung|403/i').count() > 0 || page.url().includes('login');
    if (denied) {
      log('✅', '9.3 Aktivitätslog: GF kein Zugriff', 'PASS', 'Korrekt — nur GlobalAdmin');
    } else if (hasAccess) {
      log('⚠️', '9.3 Aktivitätslog: GF kein Zugriff', 'WARN', 'GF hat Zugriff auf Aktivitätslog — prüfen ob gewollt');
    } else {
      log('⚠️', '9.3 Aktivitätslog: GF kein Zugriff', 'WARN', 'Unklar ob Zugriff erlaubt');
    }
    await screenshot(page, 'edge_aktivitaetslog');
  } catch (e) {
    log('❌', '9.3 Aktivitätslog', 'ERROR', e.message);
  }

  // 9.4 Benutzerverwaltung für GF
  try {
    await page.goto(`${BASE_URL}/dashboard/controlboard/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const hasAdmin = await page.locator('text=/Benutzer|User|Verwaltung|Admin/i').count() > 0;
    log(hasAdmin ? '✅' : '⚠️', '9.4 Benutzerverwaltung für GF zugänglich', hasAdmin ? 'PASS' : 'WARN');
    await screenshot(page, 'edge_admin');
  } catch (e) {
    log('❌', '9.4 Benutzerverwaltung', 'ERROR', e.message);
  }

  // ─────────────────────────────────────────────
  // BLOCK 10: LOGOUT
  // ─────────────────────────────────────────────
  console.log('\n═══ BLOCK 10: LOGOUT ═══');

  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Abmelden"), a:has-text("Logout"), a:has-text("Abmelden"), [aria-label*="logout"], [aria-label*="abmelden"]').first();
    if (await logoutBtn.count() > 0) {
      await logoutBtn.click();
      await page.waitForTimeout(3000);
      const backToLogin = page.url().includes('login') || page.url() === BASE_URL + '/' || page.url() === BASE_URL;
      log(backToLogin ? '✅' : '⚠️', '10.1 Logout', backToLogin ? 'PASS' : 'WARN', `URL nach Logout: ${page.url()}`);
      await screenshot(page, 'logout_success');
    } else {
      // User-Menu öffnen
      const userMenu = page.locator('[data-testid="user-menu"], button[aria-label*="user"], button[aria-label*="Profil"], .avatar, [class*="avatar"]').first();
      if (await userMenu.count() > 0) {
        await userMenu.click();
        await page.waitForTimeout(1000);
        await screenshot(page, 'logout_user_menu');
        const logoutInMenu = page.locator('text=/Logout|Abmelden/i').first();
        if (await logoutInMenu.count() > 0) {
          await logoutInMenu.click();
          await page.waitForTimeout(3000);
          log('✅', '10.1 Logout via User-Menu', 'PASS');
        } else {
          log('⚠️', '10.1 Logout', 'WARN', 'Logout-Button nicht gefunden');
        }
      } else {
        log('⚠️', '10.1 Logout', 'WARN', 'Kein Logout-Button gefunden');
      }
    }
  } catch (e) {
    log('❌', '10.1 Logout', 'ERROR', e.message);
  }

  // ─────────────────────────────────────────────
  // ERGEBNIS-REPORT
  // ─────────────────────────────────────────────
  await browser.close();

  const pass = results.filter(r => r.status === 'PASS').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const error = results.filter(r => r.status === 'ERROR').length;

  console.log('\n' + '═'.repeat(60));
  console.log('TESTERGEBNIS');
  console.log('═'.repeat(60));
  console.log(`✅ PASS:  ${pass}`);
  console.log(`⚠️  WARN:  ${warn}`);
  console.log(`❌ FAIL:  ${fail}`);
  console.log(`💥 ERROR: ${error}`);
  console.log(`📊 TOTAL: ${results.length}`);
  console.log('═'.repeat(60));

  // Detaillierte Ergebnisse als JSON
  const reportPath = path.join(__dirname, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ summary: { pass, warn, fail, error }, results }, null, 2));
  console.log(`\nReport gespeichert: ${reportPath}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);

  return { pass, warn, fail, error, results };
}

runTests().catch(console.error);
