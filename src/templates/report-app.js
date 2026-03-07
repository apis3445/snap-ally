/**
 * Report App - Vanilla JS Rendering Engine for Snap Ally
 * Replaces EJS for generating HTML reports securely using client-side DOM processing.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Pull injected data
    const data = window.snapAllyData;
    if (!data) {
        console.error('Snap Ally: No report data found in window.snapAllyData');
        return;
    }

    // Set up custom severity colors if provided
    applyCustomColors(data);

    // Determine which template we are on based on root containers
    if (document.getElementById('report-summary-root')) {
        renderExecutionSummary(data);
    } else if (document.getElementById('test-execution-root')) {
        renderTestExecutionReport(data);
    } else if (document.getElementById('accessibility-report-root')) {
        renderAccessibilityReport(data);
    }
});

/** Apply user-defined CSS overrides */
function applyCustomColors(data) {
    if (!data) return;
    const root = document.documentElement;

    // Custom colors from Summary / Execution Report (data.colors)
    if (data.colors) {
        if (data.colors.critical) root.style.setProperty('--critical', data.colors.critical);
        if (data.colors.serious) root.style.setProperty('--serious', data.colors.serious);
        if (data.colors.moderate) root.style.setProperty('--moderate', data.colors.moderate);
        if (data.colors.minor) root.style.setProperty('--minor', data.colors.minor);
    }

    // Custom colors from specific Action Report (data.criticalColor)
    if (data.criticalColor) root.style.setProperty('--critical', data.criticalColor);
    if (data.seriousColor) root.style.setProperty('--serious', data.seriousColor);
    if (data.moderateColor) root.style.setProperty('--moderate', data.moderateColor);
    if (data.minorColor) root.style.setProperty('--minor', data.minorColor);
}

// ============================================================================
// TEMPLATE 1: Test Execution Report (Individual Test Result)
// ============================================================================
function renderTestExecutionReport(data) {
    const root = document.getElementById('test-execution-root');
    if (!root) return;
    root.style.display = 'block';

    // Set document title
    document.title = `Snap Ally - Test Execution: ${data.title}`;

    // Header
    document.getElementById('report-title').textContent = data.title;

    const statusBadge = document.getElementById('report-status-badge');
    statusBadge.classList.add(`status-${data.status}`);
    document.getElementById('report-status-icon').textContent = data.statusIcon;
    document.getElementById('report-status-text').textContent = data.status;

    if (data.a11yReportPath && data.a11yErrorCount === 0) {
        document.getElementById('report-a11y-verified').style.display = 'flex';
    }

    document.getElementById('report-duration').textContent = data.duration;
    document.getElementById('report-browser').textContent = data.browser;

    // Tags
    const tagsContainer = document.getElementById('report-tags-container');
    const tagTemplate = document.getElementById('tag-template');
    (data.tags || []).forEach((tag) => {
        const clone = tagTemplate.content.cloneNode(true);
        clone.querySelector('.tag-badge').textContent = tag;
        tagsContainer.appendChild(clone);
    });

    if (data.a11yReportPath) {
        const a11yLink = document.getElementById('view-a11y-report-link');
        a11yLink.href = `./${data.a11yReportPath}`;
        a11yLink.style.display = 'flex';
    }

    // Description
    if (data.description) {
        document.getElementById('card-description').style.display = 'block';
        document.getElementById('report-description').textContent = data.description;
    }

    // Helper method for array elements
    const renderList = (array, listId, cardId) => {
        if (array && array.length > 0) {
            document.getElementById(cardId).style.display = 'block';
            const list = document.getElementById(listId);
            const tpl = document.getElementById('string-item-template');
            array.forEach((item) => {
                const clone = tpl.content.cloneNode(true);
                clone.querySelector('li').textContent = item;
                list.appendChild(clone);
            });
        }
    };

    renderList(data.preConditions, 'list-preconditions', 'card-preconditions');
    renderList(data.steps, 'list-steps', 'card-steps');
    renderList(data.postConditions, 'list-postconditions', 'card-postconditions');

    // Exceptions (Filter out A11y generic error text)
    const filteredErrs = (data.errors || []).filter(
        (err) => !err.includes('Accessibility audit failed')
    );
    renderList(filteredErrs, 'list-exceptions', 'card-exceptions');

    if (data.videoPath) {
        document.getElementById('card-video').style.display = 'block';
        const source = document.getElementById('report-video-source');
        source.src = data.videoPath;
        source.parentElement.load();
    }

    if (data.screenshotPaths && data.screenshotPaths.length > 0) {
        document.getElementById('card-screenshots').style.display = 'block';
        const grid = document.getElementById('grid-screenshots');
        const tpl = document.getElementById('screenshot-template');
        data.screenshotPaths.forEach((p) => {
            const clone = tpl.content.cloneNode(true);
            clone.querySelector('img').src = p;
            grid.appendChild(clone);
        });
    }

    if (data.attachments && data.attachments.length > 0) {
        document.getElementById('card-attachments').style.display = 'block';
        const list = document.getElementById('list-attachments');
        const tpl = document.getElementById('attachment-template');
        data.attachments.forEach((att) => {
            const clone = tpl.content.cloneNode(true);
            const a = clone.querySelector('a');
            a.href = att.path;
            clone.querySelector('.attachment-name').textContent = att.name;
            list.appendChild(clone);
        });
    }

    // Accessibility Success / Error Cards inside general test report
    if (data.a11yReportPath && data.a11yErrorCount === 0) {
        document.getElementById('card-a11y-success').style.display = 'flex';
    } else if (data.a11yErrors && data.a11yErrors.length > 0) {
        document.getElementById('card-a11y-errors').style.display = 'block';
        const list = document.getElementById('list-a11y-errors');
        const tplError = document.getElementById('a11y-error-template');
        const tplInstance = document.getElementById('a11y-instance-template');

        data.a11yErrors.forEach((error) => {
            const clone = tplError.content.cloneNode(true);
            clone.querySelector('.violation-item').classList.add(error.severity);
            clone.querySelector('.rule-id').textContent = error.id;
            const sevBadge = clone.querySelector('.sev-badge');
            sevBadge.classList.add(error.severity);
            sevBadge.textContent = error.severity;
            clone.querySelector('.help-text').textContent = error.help;
            if (error.description) {
                const desc = clone.querySelector('.desc-text');
                desc.textContent = error.description;
                desc.style.display = 'block';
            }
            clone.querySelector('.occ-count').textContent = error.total;

            const grid = clone.querySelector('.instance-grid');
            if (error.target && error.target.length > 0) {
                error.target.forEach((t) => {
                    if (t.screenshot) {
                        const iClone = tplInstance.content.cloneNode(true);
                        iClone.querySelector('img').src = t.screenshot;
                        iClone.querySelector('img').alt = `Violation on ${t.element}`;
                        const info = iClone.querySelector('.instance-info');
                        info.textContent = t.element;
                        info.title = t.element;
                        grid.appendChild(iClone);
                    }
                });
            }
            list.appendChild(clone);
        });
    }
}

// ============================================================================
// TEMPLATE 2: Global Execution Summary (Tabs, Charts, Tables)
// ============================================================================
function renderExecutionSummary(data) {
    const root = document.getElementById('report-summary-root');
    if (!root) return;
    root.style.display = 'block';

    // Hero Section
    document.getElementById('summary-status-badge').classList.add(`status-${data.status}`);
    document.getElementById('summary-status-icon').textContent = data.statusIcon;
    document.getElementById('summary-status-text').textContent = data.status;
    document.getElementById('summary-date').textContent = data.date;
    document.getElementById('summary-duration').textContent = data.duration;

    // Top Level Metrics
    const setElText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    setElText('summary-total', data.total);
    setElText('summary-passed', data.totalPassed);
    setElText('summary-failed', data.totalFailed);
    setElText('summary-flaky', data.totalFlaky);
    setElText('summary-skipped', data.totalSkipped);

    const browsers = Object.keys(data.browserSummaries);

    const setElDisplay = (id, disp) => {
        const el = document.getElementById(id);
        if (el) el.style.display = disp;
    };

    if (data.totalA11yErrorCount > 0) {
        setElDisplay('summary-global-a11y-box', 'flex');
        setElText('summary-a11y-total', data.totalA11yErrorCount);
        setElDisplay('global-errors-container', 'block');

        // Populate WCAG Error Cards
        const wcagGrid = document.getElementById('global-metrics-grid');
        const wcagTpl = document.getElementById('wcag-metric-template');
        Object.entries(data.wcagErrors)
            .sort((a, b) => b[1].count - a[1].count)
            .forEach(([rule, info]) => {
                const clone = wcagTpl.content.cloneNode(true);
                const card = clone.querySelector('.metric-card');
                card.classList.add(info.severity);
                clone.querySelector('.metric-rule').textContent = rule;
                const sev = clone.querySelector('.metric-sev');
                sev.textContent = info.severity;
                sev.classList.add(info.severity);

                if (info.description) {
                    const desc = clone.querySelector('.metric-desc');
                    desc.textContent = info.description;
                    desc.style.display = 'block';
                }

                const count = clone.querySelector('.metric-count');
                count.textContent = info.count;
                count.classList.add(info.severity);

                if (info.helpUrl) {
                    const btn = clone.querySelector('.btn-guide');
                    btn.href = info.helpUrl;
                    btn.style.display = 'inline-flex';
                }
                wcagGrid.appendChild(clone);
            });
    } else {
        const successCard = document.getElementById('global-success-card');
        successCard.style.display = 'block'; // Container block, layout inside is flex
        const icon = document.getElementById('global-success-icon');
        const title = document.getElementById('global-success-title');
        const desc = document.getElementById('global-success-desc');

        if (data.status === 'failed') {
            icon.textContent = 'report_off';
            icon.style.color = 'rgba(255,255,255,0.8)';
            title.textContent = 'Accessibility Checks Passed';
            desc.textContent =
                'No accessibility violations were detected. However, some functional tests failed. Please review the detailed logs below.';
            successCard.style.background = 'linear-gradient(135deg, #475569 0%, #1e293b 100%)';
            successCard.style.boxShadow = '0 20px 50px rgba(30, 41, 59, 0.2)';
        } else {
            icon.textContent = 'verified_user';
            title.textContent = 'Compliance Verified';
            desc.textContent =
                'Congratulations! Your application passed all accessibility checks with flying colors. Your interface is inclusive and compliant.';
        }
    }

    // Browser Tabs rendering
    const tabBtnContainer = document.getElementById('summary-tabs-container');
    const tabBtnTpl = document.getElementById('browser-tab-btn-template');

    const contentContainer = document.getElementById('browser-tabs-content');
    const browserTpl = document.getElementById('browser-tab-content-template');

    browsers.forEach((browser) => {
        // 1. Create Tab Button
        const btnClone = tabBtnTpl.content.cloneNode(true);
        const btn = btnClone.querySelector('.tab-btn');
        const capBrowser = browser.charAt(0).toUpperCase() + browser.slice(1);
        btn.textContent = capBrowser;
        btn.setAttribute('data-target', browser);
        tabBtnContainer.appendChild(btnClone);

        // 2. Create Tab Content
        const bStats = data.browserSummaries[browser];
        const contentClone = browserTpl.content.cloneNode(true);
        const tabDiv = contentClone.querySelector('.tab-content');
        tabDiv.id = `tab-${browser}`;

        if (bStats.totalA11yErrorCount > 0) {
            contentClone.querySelector('.browser-errors-container').style.display = 'block';
            contentClone.querySelector('.browser-chart-title').textContent = capBrowser;
            contentClone.querySelector('.browser-chart-container').id =
                `chart-${browser}-violations`;

            const bGrid = contentClone.querySelector('.browser-metrics-grid');
            const wcagTpl = document.getElementById('wcag-metric-template');

            Object.entries(bStats.wcagErrors)
                .sort((a, b) => b[1].count - a[1].count)
                .forEach(([rule, info]) => {
                    const mClone = wcagTpl.content.cloneNode(true);
                    const card = mClone.querySelector('.metric-card');
                    card.classList.add(info.severity);
                    mClone.querySelector('.metric-rule').textContent = rule;
                    const sev = mClone.querySelector('.metric-sev');
                    sev.textContent = info.severity;
                    sev.classList.add(info.severity);

                    if (info.description) {
                        const desc = mClone.querySelector('.metric-desc');
                        desc.textContent = info.description;
                        desc.style.display = 'block';
                    }

                    const count = mClone.querySelector('.metric-count');
                    count.textContent = info.count;
                    count.classList.add(info.severity);
                    bGrid.appendChild(mClone);
                });
        } else {
            const sucContainer = contentClone.querySelector('.browser-success-container');
            sucContainer.style.display = 'block'; // Container block, layout inside is flex
            const bTitle = sucContainer.querySelector('.browser-success-title');
            if (bTitle) bTitle.textContent = `${capBrowser} Compliant`;
        }

        contentContainer.appendChild(contentClone);
    });

    // Test Suite Details Accordion
    const accordionContainer = document.getElementById('accordion-container');
    const groupTpl = document.getElementById('group-section-template');
    const testTpl = document.getElementById('test-card-template');

    Object.keys(data.groupedResults).forEach((groupKey) => {
        const groupClone = groupTpl.content.cloneNode(true);
        const section = groupClone.querySelector('.group-section');
        if (data.groupedResults[groupKey].length === 0) {
            section.classList.add('hidden');
        }

        groupClone.querySelector('.group-title').textContent = groupKey;
        const gContent = groupClone.querySelector('.group-content');

        data.groupedResults[groupKey].forEach((test) => {
            const tClone = testTpl.content.cloneNode(true);
            const a = tClone.querySelector('a');
            a.href = `./${test.executionReportPath}`;
            a.setAttribute('data-browser', test.browser);

            const icon = tClone.querySelector('.status-icon-small');
            icon.classList.add(`status-icon-${test.status}`);
            icon.textContent = test.statusIcon;

            tClone.querySelector('.test-title').textContent = `${test.num}. ${test.title}`;

            const bChip = tClone.querySelector('.browser-chip');
            bChip.textContent = test.browser;
            bChip.classList.add(`chip-${test.browser.toLowerCase()}`);

            const badge = tClone.querySelector('.err-badge');
            if (test.a11yErrorCount > 0) {
                badge.style.display = 'inline-block';
                badge.textContent = `${test.a11yErrorCount} errors`;
            } else if (test.status === 'failed') {
                badge.style.display = 'inline-block';
                badge.textContent = 'Functional Error';
                badge.style.border = '1px solid #fecdd3';
            }

            tClone.querySelector('.test-dur').textContent = test.duration;
            gContent.appendChild(tClone);
        });

        accordionContainer.appendChild(groupClone);
    });

    // Setup UI Interactions
    setupTabs();
    setupAccordions();

    // Render Charts if ApexCharts is loaded
    if (typeof ApexCharts !== 'undefined') {
        if (data.totalA11yErrorCount > 0) {
            renderBarChart('chart-global-violations', data.wcagErrors, data.colors);
        }
        browsers.forEach((browser) => {
            if (data.browserSummaries[browser].totalA11yErrorCount > 0) {
                renderBarChart(
                    `chart-${browser}-violations`,
                    data.browserSummaries[browser].wcagErrors,
                    data.colors
                );
            }
        });
    }
}

// ============================================================================
// TEMPLATE 3: Single Page Accessibility Report
// ============================================================================
function renderAccessibilityReport(injectedData) {
    const root = document.getElementById('accessibility-report-root');
    if (!root) return;
    root.style.display = 'block';

    document.title = 'Snap Ally - Accessibility Audit';

    // Support nested data format from SnapAllyReporter
    const data = injectedData.data || injectedData;
    const pageUrl = data.pageUrl || data.pageKey || 'Resource';
    const timestamp = data.timestamp || new Date().toLocaleString();
    const violations = data.a11yErrors || data.errors || data.violations || [];
    let failedCount = 0;
    if (typeof data.a11yErrorCount !== 'undefined') {
        failedCount = data.a11yErrorCount;
    } else if (typeof data.failed !== 'undefined') {
        failedCount = data.failed;
    } else {
        failedCount = violations.reduce(
            (acc, v) => acc + (v.total || v.target?.length || v.nodes?.length || 0),
            0
        );
    }
    const videoPath = data.video || data.videoPath || '';

    // Hero Section
    const pageUrlEl = document.getElementById('a11y-page-url');
    if (pageUrlEl) pageUrlEl.textContent = pageUrl;

    const timestampEl = document.getElementById('a11y-timestamp');
    if (timestampEl) timestampEl.textContent = timestamp;

    if (failedCount === 0) {
        const passedPill = document.getElementById('a11y-pill-passed');
        if (passedPill) passedPill.style.display = 'flex';
        const successCard = document.getElementById('a11y-success-card');
        if (successCard) successCard.style.display = 'flex';
    } else {
        const failedPill = document.getElementById('a11y-pill-failed');
        if (failedPill) failedPill.style.display = 'flex';
        const failedCountEl = document.getElementById('a11y-failed-count');
        if (failedCountEl) failedCountEl.textContent = failedCount;
    }

    // Render video section if exists
    if (videoPath) {
        document.getElementById('a11y-video-card').style.display = 'block';
        const source = document.getElementById('a11y-video-source');
        source.src = videoPath;
        source.parentElement.load();
    }

    // Iterate over violations
    if (violations && violations.length > 0) {
        const container = document.getElementById('a11y-violations-container');
        const vTpl = document.getElementById('violation-card-template');
        const bTpl = document.getElementById('bug-list-item-template');

        violations.forEach((v) => {
            const impact = v.severity || v.impact;
            const nodes = v.target || v.nodes || [];

            const vClone = vTpl.content.cloneNode(true);

            vClone.querySelector('.violation-title').textContent = v.id;
            vClone.querySelector('.rule-name').textContent =
                v.wcagRule || (v.tags ? v.tags.join(', ') : '');
            vClone.querySelector('.rule-wcag-tags').textContent = v.help;

            const badge = vClone.querySelector('.severity-badge');
            badge.classList.add(impact);
            badge.textContent = impact;

            vClone.querySelector('.fix-desc').textContent = v.description;
            vClone.querySelector('.fix-link').href = v.helpUrl;
            vClone.querySelector('.instances-count').textContent = nodes.length;

            const instancesContainer = vClone.querySelector('.instances-container');

            nodes.forEach((node, idx) => {
                const bClone = bTpl.content.cloneNode(true);
                const snippetText =
                    node.snippet ||
                    node.friendlySnippet ||
                    node.element ||
                    node.target?.[0] ||
                    'Unknown Node';

                // Setup accordion IDs
                const header = bClone.querySelector('.bug-item-header');
                const collapseBody = bClone.querySelector('.collapse');
                const vIdSafe = (v.id || 'err').replace(/[^a-zA-Z0-9]/g, '-');
                const collapseId = `details-${vIdSafe}-${idx}`;
                header.setAttribute('data-bs-target', `#${collapseId}`);
                collapseBody.id = collapseId;

                // Map data
                bClone.querySelector('.bug-rule-name').textContent = v.help;
                bClone.querySelector('.bug-snippet-text').textContent = snippetText;

                const btn = bClone.querySelector('.btn-bug');
                // generateAdoPayload binding
                const safeSnippet = escapeHtml(snippetText);
                const wcag = escapeHtml(v.wcagRule || (v.tags ? v.tags.join(', ') : ''));
                btn.setAttribute(
                    'onclick',
                    `event.preventDefault(); event.stopPropagation(); window.generateAdoPayload('${escapeHtml(v.id || 'Unknown ID')}', '${escapeHtml(v.help || 'No Help Provided')}', '${escapeHtml(node.failureSummary || '')}', '${escapeHtml(node.html || '')}', '${impact || 'unknown'}', '${escapeHtml(node.screenshotBase64 || node.screenshot || node.screenshotPath || '')}', '${escapeHtml(videoPath || '')}', '${safeSnippet}', '${wcag}')`
                );

                const failSec = bClone.querySelector('.bug-failure-summary');
                let stepsArray = node.steps || [];
                if (typeof stepsArray === 'string') {
                    try {
                        stepsArray = JSON.parse(stepsArray);
                    } catch {
                        stepsArray = [];
                    }
                }

                if (stepsArray && stepsArray.length > 0) {
                    failSec.innerHTML = `<ol style="margin: 0; padding-left: 18px; line-height: 1.5;">${stepsArray.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`;
                    failSec.style.fontFamily = 'Inter, sans-serif';
                    failSec.style.fontSize = '0.9rem';
                    failSec.style.color = 'var(--text-main)';
                    failSec.style.whiteSpace = 'normal';
                } else if (node.failureSummary) {
                    failSec.textContent = node.failureSummary;
                }

                if (node.screenshot || node.screenshotPath) {
                    const visSec = bClone.querySelector('.visual-evidence-section');
                    visSec.style.display = 'block';
                    bClone.querySelector('.bug-screenshot').src =
                        node.screenshot || node.screenshotPath;
                }

                instancesContainer.appendChild(bClone);
            });

            container.appendChild(vClone);
        });
    }
}

// ============================================================================
// Helper Utilities
// ============================================================================

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');

            // Update Tab Styles
            document.querySelectorAll('.tab-btn').forEach((tb) => tb.classList.remove('active'));
            document
                .querySelectorAll('.tab-content')
                .forEach((tc) => tc.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('tab-' + targetId).classList.add('active');

            // Filter Accordion Cards
            document.querySelectorAll('.test-card').forEach((card) => {
                if (targetId === 'global' || card.getAttribute('data-browser') === targetId) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });

            // Filter empty accordions
            document.querySelectorAll('.group-section').forEach((group) => {
                const hasVisible = Array.from(group.querySelectorAll('.test-card')).some(
                    (c) => c.style.display !== 'none'
                );
                group.style.display = hasVisible ? 'block' : 'none';
            });

            window.dispatchEvent(new Event('resize'));
        });
    });
}

function setupAccordions() {
    document.querySelectorAll('.group-header').forEach((header) => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('collapsed');
        });
    });
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Chart Generation
function renderBarChart(elementId, wcagData, colors) {
    const el = document.querySelector('#' + elementId);
    if (!el) {
        throw new Error('CRITICAL_NULL_ELEMENT_ID: ' + elementId);
    }

    const wcagEntries = Object.entries(wcagData).sort((a, b) => b[1].count - a[1].count);
    if (wcagEntries.length === 0) return;

    const chartColors = wcagEntries.map((e) => colors[e[1].severity] || '#ef4444');

    new ApexCharts(document.querySelector('#' + elementId), {
        chart: { type: 'bar', height: 350, toolbar: { show: false } },
        series: [{ name: 'Violations', data: wcagEntries.map((e) => e[1].count) }],
        xaxis: {
            categories: wcagEntries.map((e) => e[0]),
            labels: {
                style: {
                    fontFamily: 'Inter',
                    fontSize: '14px',
                    fontWeight: 700,
                    colors: '#475569',
                },
            },
            forceNiceScale: true,
            decimalsInFloat: 0,
        },
        yaxis: { labels: { style: { fontWeight: 600, fontSize: '15px' } } },
        colors: chartColors,
        plotOptions: {
            bar: {
                borderRadius: 6,
                horizontal: true,
                barHeight: '70%',
                distributed: true,
                dataLabels: { position: 'top' },
            },
        },
        fill: { type: 'solid', opacity: 1 },
        states: { hover: { filter: { type: 'darken', value: 0.9 } } },
        grid: { borderColor: '#f1f5f9', padding: { right: 50, left: 10 } },
        dataLabels: {
            enabled: true,
            textAnchor: 'start',
            offsetX: 10,
            style: { fontSize: '16px', fontWeight: 900, colors: ['#0f172a'] },
            background: { enabled: false },
            dropShadow: { enabled: false },
        },
        legend: { show: false },
        tooltip: { theme: 'light', style: { fontFamily: 'Inter' } },
    }).render();
}

// ============================================================================
// ADO Integration
// ============================================================================

window.addEventListener('load', function () {
    const tokenForm = document.getElementById('tokenForm');
    if (tokenForm) {
        tokenForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const token = document.getElementById('tokenInput').value;
            if (token) {
                sessionStorage.setItem('userToken', token);
                const modalEl = document.getElementById('tokenModal');
                if (window.bootstrap && bootstrap.Modal) {
                    bootstrap.Modal.getInstance(modalEl).hide();
                }
            }
        });
    }

    const confirmBugBtn = document.getElementById('confirmBugBtn');
    if (confirmBugBtn) {
        confirmBugBtn.addEventListener('click', async () => {
            const btn = document.getElementById('confirmBugBtn');
            const modalEl = document.getElementById('bugPreviewModal');
            let modalInst = null;
            if (window.bootstrap) {
                modalInst = bootstrap.Modal.getInstance(modalEl);
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating...';

            try {
                await submitFinalBug();
                if (modalInst) modalInst.hide();
            } catch (err) {
                console.error(err);
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Create Bug';
            }
        });
    }

    const bugModalEl = document.getElementById('bugPreviewModal');
    if (bugModalEl && window.bootstrap) {
        bugModalEl.addEventListener('shown.bs.modal', function () {
            const input = document.getElementById('bugTitleInput');
            if (input) {
                input.focus();
                input.select();
                input.removeAttribute('readonly');
                input.removeAttribute('disabled');
            }
        });
    }
});

window.generateAdoPayload = function (
    axeId,
    help,
    failureSummary,
    htmlSnippet,
    severity,
    screenshotBase64,
    videoPath,
    snippet,
    wcag
) {
    const pat = sessionStorage.getItem('userToken');
    if (!pat && window.bootstrap) {
        const tokenModal = bootstrap.Modal.getOrCreateInstance(
            document.getElementById('tokenModal')
        );
        tokenModal.show();
        return;
    }

    document.getElementById('bugTitleInput').value = `[A11y] ${help} (${snippet})`;
    document.getElementById('bugSeverityInput').value = severity;

    const data = window.snapAllyData || {};
    const currentUrl = document.getElementById('bugUrlPreview');
    if (currentUrl) currentUrl.textContent = data.pageUrl || data.pageKey || 'Resource';

    const stepsHtml = `
    <div style="font-family: monospace; background: #fffcf0; padding: 12px; border: 1px solid #e2e8f0;">
      ${failureSummary ? failureSummary.replace(/\\n/g, '<br>') : 'Issue discovered via static analysis scans.'}
    </div>
    <br>
    <div style="font-family: monospace; background: #fffcf0; padding: 12px; border: 1px solid #e2e8f0; overflow-x: auto;">
      ${htmlSnippet ? htmlSnippet.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'No DOM snippet available.'}
    </div>
  `;

    document.getElementById('bugReproPreview').innerHTML = `
    <div style="margin-bottom: 4px;"><b>Rule:</b> ${axeId} (${wcag})</div>
    <div style="margin-bottom: 8px;"><b>Recommendation:</b> ${help}</div>
    <div style="border-top: 1px solid #e2e8f0; margin: 8px 0; padding-top: 8px;"><b>Failure Summary:</b></div>
    ${stepsHtml}
  `;

    const screenshotPreview = document.getElementById('bugScreenshotPreview');
    const screenshotThumbContainer = document.getElementById('screenshotThumbContainer');
    if (screenshotBase64) {
        if (screenshotBase64.startsWith('data:')) {
            screenshotPreview.src = screenshotBase64;
        } else if (
            screenshotBase64.startsWith('http') ||
            screenshotBase64.startsWith('./') ||
            screenshotBase64.includes('.')
        ) {
            screenshotPreview.src = screenshotBase64;
        } else {
            screenshotPreview.src = `data:image/png;base64,${screenshotBase64}`;
        }
        if (screenshotThumbContainer) screenshotThumbContainer.style.display = 'block';
    } else {
        if (screenshotThumbContainer) screenshotThumbContainer.style.display = 'none';
    }

    const videoThumbContainer = document.getElementById('videoThumbContainer');
    const videoPreview = document.getElementById('bugVideoPreview');
    if (videoPath) {
        if (videoPreview) videoPreview.src = videoPath;
        if (videoThumbContainer) videoThumbContainer.style.display = 'block';
    } else {
        if (videoThumbContainer) videoThumbContainer.style.display = 'none';
    }

    window.currentBugData = { axeId, wcag, help, stepsHtml, screenshotBase64, videoPath };

    if (window.bootstrap) {
        const modal = bootstrap.Modal.getOrCreateInstance(
            document.getElementById('bugPreviewModal')
        );
        modal.show();
    }
};

async function uploadAttachment(blob, name) {
    const data = window.snapAllyData || {};
    const org = data.adoOrganization;
    const proj = data.adoProject;
    const pat = sessionStorage.getItem('userToken');
    if (!org || !proj || !pat) return null;

    const url = `https://dev.azure.com/${org}/${proj}/_apis/wit/attachments?fileName=${name}&api-version=7.1`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            Authorization: `Basic ${btoa(':' + pat)}`,
        },
        body: blob,
    });
    return res.ok ? (await res.json()).url : null;
}

async function submitFinalBug() {
    const data = window.snapAllyData || {};
    const org = data.adoOrganization;
    const proj = data.adoProject;
    const pat = sessionStorage.getItem('userToken');
    const { axeId, wcag, help, stepsHtml, screenshotBase64, videoPath } = window.currentBugData;

    const title = document.getElementById('bugTitleInput').value;
    const severity = document.getElementById('bugSeverityInput').value;
    const area = document.getElementById('bugAreaInput').value || 'Accessibility';

    let screenshotUrl = null;
    if (screenshotBase64) {
        let screenshotBlob;
        if (screenshotBase64.startsWith('data:')) {
            screenshotBlob = await fetch(screenshotBase64).then((res) => res.blob());
        } else if (screenshotBase64.startsWith('http') || screenshotBase64.startsWith('./')) {
            screenshotBlob = await fetch(screenshotBase64).then((res) => res.blob());
        } else {
            screenshotBlob = await fetch(`data:image/png;base64,${screenshotBase64}`).then((res) =>
                res.blob()
            );
        }
        screenshotUrl = await uploadAttachment(screenshotBlob, 'a11y-issue.png');
    }

    let videoUrl = null;
    if (videoPath) {
        try {
            const videoBlob = await fetch(videoPath).then((res) => res.blob());
            videoUrl = await uploadAttachment(videoBlob, 'session-recording.webm');
        } catch (e) {
            console.error('Failed to video upload', e);
        }
    }

    const combinedReproHtml = `
    <div style="margin-bottom: 12px;"><b>Rule:</b> ${axeId} (${wcag})</div>
    <div style="margin-bottom: 12px;"><b>Recommendation:</b> ${help}</div>
    <hr>
    <div style="margin-bottom: 8px;"><b>Failure Trace & Details:</b></div>
    ${stepsHtml}
  `;

    const safePageKey = data.pageKey || 'Unknown URL';
    const priority = severity === 'critical' ? 1 : severity === 'serious' ? 2 : 3;

    const payload = [
        { op: 'add', path: '/fields/System.Title', value: title },
        { op: 'add', path: '/fields/Microsoft.VSTS.TCM.ReproSteps', value: combinedReproHtml },
        {
            op: 'add',
            path: '/fields/System.Description',
            value: `Found at URL / Resource: <a href="${safePageKey}">${safePageKey}</a>`,
        },
        { op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: priority },
        { op: 'add', path: '/fields/System.AreaPath', value: `${proj}\\\\${area}` },
        { op: 'add', path: '/fields/System.Tags', value: 'A11y;SnapAlly;UI-Test' },
    ];

    if (screenshotUrl) {
        payload.push({
            op: 'add',
            path: '/relations/-',
            value: {
                rel: 'AttachedFile',
                url: screenshotUrl,
                attributes: { comment: 'Accessibility Violation Screenshot' },
            },
        });
    }

    if (videoUrl) {
        payload.push({
            op: 'add',
            path: '/relations/-',
            value: {
                rel: 'AttachedFile',
                url: videoUrl,
                attributes: { comment: 'Audit Session Recording' },
            },
        });
    }

    const res = await fetch(
        `https://dev.azure.com/${org}/${proj}/_apis/wit/workitems/$Bug?api-version=7.1`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json-patch+json',
                Authorization: `Basic ${btoa(':' + pat)}`,
            },
            body: JSON.stringify(payload),
        }
    );

    if (res.ok) alert('Bug successfully filed in Azure DevOps!');
    else {
        const errorBody = await res.text();
        console.error('ADO Bug Creation Error', errorBody);
        alert(
            'Failed to create bug. Check token and organization settings. Error: ' +
                errorBody.slice(0, 100)
        );
    }
}
