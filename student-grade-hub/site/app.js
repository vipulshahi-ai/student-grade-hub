const form = document.querySelector('#lookup-form');
const input = document.querySelector('#student-id');
const message = document.querySelector('#status-message');
const report = document.querySelector('#report');

form.addEventListener('submit', async event => {
  event.preventDefault();
  const id = input.value.trim();
  if (!id) return;
  if (!window.GRADE_HUB_API_URL || window.GRADE_HUB_API_URL.includes('PASTE_YOUR')) {
    showMessage('The report service is not configured yet. Please contact the course team.', true);
    return;
  }
  showMessage('Retrieving your report…');
  report.classList.add('hidden');
  try {
    const data = await jsonp(window.GRADE_HUB_API_URL, { id });
    if (!data.ok) throw new Error(data.error || 'The report could not be retrieved.');
    renderReport(data.report);
    showMessage('');
  } catch (error) {
    showMessage(error.message || 'The report could not be retrieved.', true);
  }
});

function jsonp(endpoint, params) {
  return new Promise((resolve, reject) => {
    const callback = `gradeHubCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const url = new URL(endpoint);
    Object.entries({ ...params, callback }).forEach(([key, value]) => url.searchParams.set(key, value));
    const script = document.createElement('script');
    const timer = window.setTimeout(() => finish(new Error('The report service took too long to respond.')), 12000);
    const finish = error => {
      window.clearTimeout(timer);
      script.remove();
      delete window[callback];
      if (error) reject(error);
    };
    window[callback] = data => { finish(); resolve(data); };
    script.onerror = () => finish(new Error('Could not connect to the report service.'));
    script.src = url.toString();
    document.head.appendChild(script);
  });
}

function renderReport(data) {
  report.classList.remove('hidden');
  document.querySelector('#student-name').textContent = data.name;
  document.querySelector('#student-meta').textContent = `${data.section} · Admission: ${data.admissionNo}`;
  document.querySelector('#overall-score').textContent = formatScore(data.normalizedScore);
  document.querySelector('#activity-count').textContent = data.activities.length;
  document.querySelector('#submitted-count').textContent = data.submitted;
  document.querySelector('#missing-count').textContent = data.notSubmitted;
  renderChart(data.activities);
  renderActivities(data.activities);
}

function renderActivities(activities) {
  const list = document.querySelector('#activity-list');
  list.replaceChildren(...activities.map(activity => {
    const card = document.createElement('article');
    card.className = 'activity-card';
    const top = document.createElement('div');
    top.className = 'activity-top';
    const heading = document.createElement('div');
    const label = document.createElement('p');
    label.className = 'activity-type';
    label.textContent = `${activity.id} · ${activity.category}`;
    const title = document.createElement('h4');
    title.textContent = activity.title;
    heading.append(label, title);
    const score = document.createElement('strong');
    score.className = 'activity-score';
    score.textContent = `${formatScore(activity.normalizedScore)}/100`;
    top.append(heading, score);
    const details = document.createElement('p');
    details.className = 'activity-details';
    details.textContent = activity.status === 'Submitted'
      ? `Marks: ${activity.marks}/${activity.maxMarks}`
      : 'No submission recorded';
    const pill = document.createElement('span');
    pill.className = `pill ${activity.status === 'Submitted' ? 'submitted' : 'not-submitted'}`;
    pill.textContent = activity.status;
    const feedback = document.createElement('p');
    feedback.className = 'feedback';
    feedback.textContent = activity.comment || 'No feedback shared for this activity.';
    card.append(top, pill, details, feedback);
    return card;
  }));
}

function renderChart(activities) {
  const container = document.querySelector('#performance-chart');
  container.replaceChildren();
  if (!activities.length) return;
  const width = Math.max(620, activities.length * 62);
  const height = 250, pad = { top: 18, right: 18, bottom: 48, left: 42 };
  const plotW = width - pad.left - pad.right, plotH = height - pad.top - pad.bottom;
  const x = index => pad.left + (activities.length === 1 ? plotW / 2 : index * plotW / (activities.length - 1));
  const y = score => pad.top + (100 - Math.max(0, Math.min(100, Number(score) || 0))) * plotH / 100;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');
  [0, 25, 50, 75, 100].forEach(tick => {
    const line = svgNode('line', { x1: pad.left, x2: width - pad.right, y1: y(tick), y2: y(tick), class: 'grid-line' });
    const text = svgNode('text', { x: pad.left - 8, y: y(tick) + 4, class: 'axis-label', 'text-anchor': 'end' });
    text.textContent = tick;
    svg.append(line, text);
  });
  const path = svgNode('path', { d: activities.map((a, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(a.normalizedScore)}`).join(' '), class: 'score-line' });
  svg.append(path);
  activities.forEach((activity, index) => {
    const dot = svgNode('circle', { cx: x(index), cy: y(activity.normalizedScore), r: 5, class: activity.status === 'Submitted' ? 'score-dot' : 'score-dot missing' });
    const label = svgNode('text', { x: x(index), y: height - 16, class: 'axis-label', 'text-anchor': 'middle' });
    label.textContent = activity.id;
    const title = svgNode('title');
    title.textContent = `${activity.title}: ${formatScore(activity.normalizedScore)}/100`;
    dot.append(title);
    svg.append(dot, label);
  });
  container.append(svg);
}

function svgNode(name, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function formatScore(value) {
  return Number(value || 0).toFixed(1);
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}
