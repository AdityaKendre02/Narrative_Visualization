// ===== Global State =====
let data = [];
let viewMode = 'cloud'; // for skills visualization

const colors = {
    growth: '#3fb950',
    stable: '#d29922',
    decline: '#f85149',
    high: '#bc8cff',
    medium: '#58a6ff',
    low: '#6e7681'
};

// ===== Initialize =====
d3.csv('ai_job_market_insights.csv').then(rawData => {
    data = rawData.map(d => ({
        jobTitle: d.Job_Title,
        industry: d.Industry,
        companySize: d.Company_Size,
        location: d.Location,
        aiAdoption: d.AI_Adoption_Level,
        automationRisk: d.Automation_Risk,
        skills: d.Required_Skills,
        salary: +d.Salary_USD,
        remoteFriendly: d.Remote_Friendly,
        growthProjection: d.Job_Growth_Projection
    }));

    initializeApp();
});

function initializeApp() {
    updateIntroStats();
    createChart1_AIImpact();
    createChart3_Skills();
    createChart4_Compensation();
    initializeExplorer();
    setupScrollEffects();
    updateProgressBar();
    setupListeners();
}

function setupListeners() {
    // Skills toggle listener
    const toggleBtn = document.getElementById('toggle-view');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            viewMode = viewMode === 'cloud' ? 'bar' : 'cloud';
            toggleBtn.textContent = viewMode === 'cloud' ? 'Switch to Bar Chart' : 'Switch to Word Cloud';
            createChart3_Skills();
        });
    }
}

// ===== Intro Stats =====
function updateIntroStats() {
    const totalJobs = data.length;
    animateNumber(document.getElementById('total-jobs'), 0, totalJobs, 2000);
}

function animateNumber(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            element.textContent = Math.round(end);
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, 16);
}

// ===== Chapter 2: AI Impact by Role (from v5) =====
function createChart1_AIImpact() {
    const container = d3.select('#chart-1');
    container.selectAll('*').remove();

    // Calculate AI exposure score
    const jobScores = d3.rollup(
        data,
        v => {
            const high = v.filter(d => d.aiAdoption === 'High').length;
            const medium = v.filter(d => d.aiAdoption === 'Medium').length;
            const low = v.filter(d => d.aiAdoption === 'Low').length;
            return (high * 3 + medium * 2 + low * 1) / v.length;
        },
        d => d.jobTitle
    );

    const chartData = Array.from(jobScores, ([job, score]) => ({ job, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);

    const margin = { top: 20, right: 30, bottom: 150, left: 60 };
    const width = Math.min(container.node().getBoundingClientRect().width, 800) - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(chartData.map(d => d.job))
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, 3])
        .range([height, 0]);

    const colorScale = d3.scaleSequential()
        .domain([1, 3])
        .interpolator(d3.interpolateRgb('#64748b', '#8b5cf6'));

    // Axes
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y));

    // Axis labels
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + 140)
        .attr('text-anchor', 'middle')
        .style('fill', '#94a3b8')
        .text('Job Titles / Roles');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -45)
        .attr('text-anchor', 'middle')
        .style('fill', '#94a3b8')
        .text('AI Exposure / Impact Level');

    const tooltip = createTooltip();

    svg.selectAll('.bar')
        .data(chartData)
        .join('rect')
        .attr('x', d => x(d.job))
        .attr('y', height)
        .attr('width', x.bandwidth())
        .attr('height', 0)
        .attr('fill', d => colorScale(d.score))
        .attr('rx', 4)
        .on('mouseover', (event, d) => {
            showTooltip(tooltip, event, `
                <div class="tooltip-title">${d.job}</div>
                <div class="tooltip-content">AI Exposure Score: ${d.score.toFixed(2)}/3.0</div>
            `);
        })
        .on('mouseout', () => hideTooltip(tooltip))
        .transition()
        .duration(800)
        .delay((d, i) => i * 50)
        .attr('y', d => y(d.score))
        .attr('height', d => height - y(d.score));
}

// ===== Chapter 3: In-Demand Skills (from v5) =====
function createChart3_Skills() {
    if (viewMode === 'cloud') {
        createSkillsWordCloud();
    } else {
        createSkillsBarChart();
    }
}

function createSkillsWordCloud() {
    const container = d3.select('#chart-3');
    container.selectAll('*').remove();

    const skillCounts = d3.rollup(data, v => v.length, d => d.skills);
    const words = Array.from(skillCounts, ([skill, count]) => ({ text: skill, size: count }));

    const width = Math.min(container.node().getBoundingClientRect().width, 800);
    const height = 500;

    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    const sizeScale = d3.scaleLinear()
        .domain(d3.extent(words, d => d.size))
        .range([20, 80]);

    const colorScale = d3.scaleOrdinal()
        .range(['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b']);

    const tooltip = createTooltip();

    svg.selectAll('text')
        .data(words)
        .join('text')
        .style('font-size', d => sizeScale(d.size) + 'px')
        .style('fill', (d, i) => colorScale(i))
        .attr('text-anchor', 'middle')
        .attr('transform', (d, i) => {
            const angle = (i / words.length) * 2 * Math.PI;
            const radius = Math.min(width, height) / 3;
            const x = Math.cos(angle) * radius * (0.5 + Math.random() * 0.5);
            const y = Math.sin(angle) * radius * (0.5 + Math.random() * 0.5);
            return `translate(${x},${y})`;
        })
        .text(d => d.text)
        .style('opacity', 0)
        .on('mouseover', (event, d) => {
            showTooltip(tooltip, event, `
                <div class="tooltip-title">${d.text}</div>
                <div class="tooltip-content">Demand: ${d.size} jobs</div>
            `);
        })
        .on('mouseout', () => hideTooltip(tooltip))
        .transition()
        .duration(800)
        .delay((d, i) => i * 50)
        .style('opacity', 1);
}

function createSkillsBarChart() {
    const container = d3.select('#chart-3');
    container.selectAll('*').remove();

    const skillCounts = d3.rollup(data, v => v.length, d => d.skills);
    const chartData = Array.from(skillCounts, ([skill, count]) => ({ skill, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const margin = { top: 20, right: 30, bottom: 40, left: 150 };
    const width = Math.min(container.node().getBoundingClientRect().width, 800) - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.count)])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(chartData.map(d => d.skill))
        .range([0, height])
        .padding(0.2);

    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y));

    // Axis labels
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + 35)
        .attr('text-anchor', 'middle')
        .style('fill', '#94a3b8')
        .text('Frequency / Demand');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -140)
        .attr('text-anchor', 'middle')
        .style('fill', '#94a3b8')
        .text('Skills (Technical and Soft)');

    const tooltip = createTooltip();

    svg.selectAll('.bar')
        .data(chartData)
        .join('rect')
        .attr('x', 0)
        .attr('y', d => y(d.skill))
        .attr('width', 0)
        .attr('height', y.bandwidth())
        .attr('fill', '#3b82f6')
        .attr('rx', 4)
        .on('mouseover', (event, d) => {
            showTooltip(tooltip, event, `
                <div class="tooltip-title">${d.skill}</div>
                <div class="tooltip-content">Demand: ${d.count} jobs</div>
            `);
        })
        .on('mouseout', () => hideTooltip(tooltip))
        .transition()
        .duration(800)
        .delay((d, i) => i * 60)
        .attr('width', d => x(d.count));
}

// ===== Chapter 4: Compensation and AI (from v5) =====
function createChart4_Compensation() {
    const container = d3.select('#chart-4');
    container.selectAll('*').remove();

    const groups = ['Low', 'Medium', 'High'];
    const boxData = groups.map(level => {
        const salaries = data
            .filter(d => d.aiAdoption === level)
            .map(d => d.salary)
            .sort(d3.ascending);

        return {
            level,
            q1: d3.quantile(salaries, 0.25),
            median: d3.quantile(salaries, 0.5),
            q3: d3.quantile(salaries, 0.75),
            min: d3.min(salaries),
            max: d3.max(salaries)
        };
    });

    const margin = { top: 20, right: 30, bottom: 60, left: 80 };
    const width = Math.min(container.node().getBoundingClientRect().width, 800) - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(groups)
        .range([0, width])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(boxData, d => d.max)])
        .range([height, 0]);

    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).tickFormat(d => `$${d / 1000}k`));

    // Axis labels
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + 45)
        .attr('text-anchor', 'middle')
        .style('fill', '#94a3b8')
        .text('AI Impact Level');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -60)
        .attr('text-anchor', 'middle')
        .style('fill', '#94a3b8')
        .text('Salary / Compensation Levels');

    const tooltip = createTooltip();
    const boxWidth = x.bandwidth();

    boxData.forEach(d => {
        const center = x(d.level) + boxWidth / 2;

        svg.append('line')
            .attr('x1', center)
            .attr('x2', center)
            .attr('y1', y(d.min))
            .attr('y2', y(d.max))
            .attr('stroke', colors[d.level.toLowerCase()])
            .attr('stroke-width', 2);

        svg.append('rect')
            .attr('x', x(d.level))
            .attr('y', y(d.q3))
            .attr('width', boxWidth)
            .attr('height', y(d.q1) - y(d.q3))
            .attr('fill', colors[d.level.toLowerCase()])
            .attr('opacity', 0.6)
            .attr('rx', 4)
            .on('mouseover', (event) => {
                showTooltip(tooltip, event, `
                    <div class="tooltip-title">AI Impact: ${d.level}</div>
                    <div class="tooltip-content">
                        Max: $${d.max.toLocaleString()}<br>
                        Q3: $${d.q3.toLocaleString()}<br>
                        Median: $${d.median.toLocaleString()}<br>
                        Q1: $${d.q1.toLocaleString()}<br>
                        Min: $${d.min.toLocaleString()}
                    </div>
                `);
            })
            .on('mouseout', () => hideTooltip(tooltip));

        svg.append('line')
            .attr('x1', x(d.level))
            .attr('x2', x(d.level) + boxWidth)
            .attr('y1', y(d.median))
            .attr('y2', y(d.median))
            .attr('stroke', '#fff')
            .attr('stroke-width', 3);
    });
}

// ===== Chapter 5: Career Explorer (from v2) =====
function initializeExplorer() {
    const jobs = [...new Set(data.map(d => d.jobTitle))].sort();
    const select = d3.select('#job-select');

    jobs.forEach(job => {
        select.append('option').attr('value', job).text(job);
    });

    select.on('change', function () {
        const selectedJob = this.value;
        if (selectedJob) {
            updateJobDetails(selectedJob);
        } else {
            d3.select('#job-details').classed('hidden', true);
        }
    });
}

function updateJobDetails(jobTitle) {
    const jobData = data.filter(d => d.jobTitle === jobTitle);

    if (jobData.length === 0) return;

    // Calculate stats
    const avgSalary = d3.mean(jobData, d => d.salary);
    const growthCounts = d3.rollup(jobData, v => v.length, d => d.growthProjection);
    const dominantGrowth = Array.from(growthCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];

    const aiCounts = d3.rollup(jobData, v => v.length, d => d.aiAdoption);
    const dominantAI = Array.from(aiCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];

    const riskCounts = d3.rollup(jobData, v => v.length, d => d.automationRisk);
    const dominantRisk = Array.from(riskCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];

    // Update UI
    d3.select('#job-salary').text(`$${avgSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    d3.select('#job-growth').text(dominantGrowth).style('color', colors[dominantGrowth.toLowerCase()]);
    d3.select('#job-ai').text(dominantAI).style('color', colors[dominantAI.toLowerCase()]);
    d3.select('#job-risk').text(dominantRisk);

    // Skills
    const skillCounts = d3.rollup(jobData, v => v.length, d => d.skills);
    const topSkills = Array.from(skillCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const skillsContainer = d3.select('#job-skills');
    skillsContainer.selectAll('*').remove();
    topSkills.forEach(([skill, count]) => {
        skillsContainer.append('span')
            .attr('class', 'skill-tag')
            .text(`${skill} (${count})`);
    });

    // Locations
    const locationCounts = d3.rollup(jobData, v => v.length, d => d.location);
    const topLocations = Array.from(locationCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const locationsContainer = d3.select('#job-locations');
    locationsContainer.selectAll('*').remove();
    topLocations.forEach(([location, count]) => {
        locationsContainer.append('span')
            .attr('class', 'location-item')
            .text(`${location} (${count})`);
    });

    // Show details
    d3.select('#job-details').classed('hidden', false);
}

// ===== Scroll Effects =====
function setupScrollEffects() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.2 });

    document.querySelectorAll('.chapter').forEach(chapter => {
        observer.observe(chapter);
    });
}

function updateProgressBar() {
    window.addEventListener('scroll', () => {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight - windowHeight;
        const scrolled = window.scrollY;
        const progress = (scrolled / documentHeight) * 100;

        document.getElementById('progress-bar').style.width = progress + '%';
    });
}

// ===== Utilities =====
function createTooltip() {
    return d3.select('body')
        .append('div')
        .attr('class', 'tooltip');
}

function showTooltip(tooltip, event, content) {
    tooltip
        .html(content)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 15) + 'px')
        .classed('show', true);
}

function hideTooltip(tooltip) {
    tooltip.classed('show', false);
}

// ===== Responsive Resize =====
window.addEventListener('resize', debounce(() => {
    createChart1_AIImpact();
    createChart3_Skills();
    createChart4_Compensation();
}, 250));

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
