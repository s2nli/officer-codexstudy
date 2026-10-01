// Course detail API handler
const OFFICERS_API_UUID = "7d85d8ba-98a2-4a9d-8980-3234d2548521";
const OFFICERS_API_BASE = `https://studyapkmodappx.vercel.app/api/${OFFICERS_API_UUID}`;

// Mock token/auth - in real Vercel app this comes from config
// For now, we'll try fetch and catch auth errors gracefully
async function fetchCourseAbout(courseId) {
  try {
    // Try to get course details from the live API
    const res = await fetch(`${OFFICERS_API_BASE}/courses`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load');
    const data = await res.json();
    const course = (Array.isArray(data.data) ? data.data : []).find(c => c.id == courseId);
    return course ? {
      name: course.course_name || 'Course',
      description: course.description || 'No description available',
      category: course.exam_category || 'General',
      price: course.price || 'Free',
      mrp: course.mrp,
      thumbnail: course.course_thumbnail || course.small_course_logo
    } : null;
  } catch (e) {
    console.error('About fetch failed:', e);
    return null;
  }
}

async function fetchCourseLectures(courseId) {
  // Format: {live: [], upcoming: [], completed: []}
  // This would need proper auth headers in production
  try {
    const res = await fetch(`${OFFICERS_API_BASE}/live?courseid=${encodeURIComponent(courseId)}&app=officers_academy`, {
      cache: 'no-store'
    });
    if (!res.ok) return { live: [], upcoming: [], completed: [] };
    return await res.json();
  } catch (e) {
    console.error('Lectures fetch failed:', e);
    return { live: [], upcoming: [], completed: [] };
  }
}

async function openCourseDetail(batch) {
  const courseId = batch._id || batch.batch_id || batch.id;
  if (!courseId) return showToast("Course ID not found");

  const modal = $("detailCourseModal");
  if (!modal) return;

  // Show loading
  const content = $("#detailCourseContent");
  if (content) content.innerHTML = '<div class="p-6 text-center"><div class="animate-spin inline-block">⟳</div> Loading...</div>';
  
  openModal("detailCourseModal");

  // Fetch data
  const [about, lectures] = await Promise.all([
    fetchCourseAbout(courseId),
    fetchCourseLectures(courseId)
  ]);

  if (!about && !lectures) {
    if (content) content.innerHTML = '<div class="p-6 text-center text-slate-400">Unable to load course details. <button onclick="openBatch_legacy()" class="link-btn link-btn-blue mt-2">Open in browser →</button></div>';
    return;
  }

  // Render detail view
  renderCourseDetail(batch, about || {}, lectures || {}, courseId);
}

function renderCourseDetail(batch, about, lectures, courseId) {
  const content = $("#detailCourseContent");
  if (!content) return;

  const allLectures = [
    ...(lectures.live || []).map(l => ({...l, status: 'live'})),
    ...(lectures.upcoming || []).map(l => ({...l, status: 'upcoming'})),
    ...(lectures.completed || []).map(l => ({...l, status: 'completed'}))
  ];

  const tabs = [
    { id: 'about', label: 'About' },
    { id: 'lectures', label: `Lectures (${allLectures.length})` },
    { id: 'notes', label: 'Notes' }
  ];

  content.innerHTML = `
    <div class="flex flex-col h-full">
      <div class="flex items-start justify-between gap-4 p-6 border-b border-slate-700/50">
        <div class="flex-1">
          <h2 class="text-xl font-bold text-white mb-1">${escape(batch.name || about.name || 'Course')}</h2>
          <p class="text-sm text-slate-400">${escape(about.category || 'General')} ${about.price && about.price !== 'Free' ? '• ' + escape(about.price) : ''}</p>
        </div>
        <button class="close-btn" data-close="detailCourseModal"></button>
      </div>

      <div class="tabs flex gap-0 px-6 pt-4 border-b border-slate-700/50 overflow-x-auto">
        ${tabs.map(t => `<button class="detail-tab px-4 py-2 text-sm font-medium text-slate-400 border-b-2 border-transparent hover:text-white transition-colors" data-tab="${t.id}">${escape(t.label)}</button>`).join('')}
      </div>

      <div class="flex-1 overflow-y-auto">
        <div id="detailAboutTab" class="detail-tab-pane p-6 hidden">
          ${about.description ? `<p class="text-slate-300 leading-relaxed">${escape(about.description)}</p>` : '<p class="text-slate-500">No description available</p>'}
          ${about.thumbnail ? `<img src="${escape(about.thumbnail)}" alt="" class="mt-4 max-w-xs rounded-lg" onerror="this.remove()">` : ''}
        </div>

        <div id="detailLecturesTab" class="detail-tab-pane p-6 hidden">
          ${allLectures.length ? `<div class="space-y-3">${allLectures.map((l, i) => `
            <div class="glass-panel rounded-lg p-4 hover:bg-slate-700/30 transition-colors cursor-pointer" onclick="playLecture('${escape(courseId)}', '${escape(l.id || l.video_id || '')}', this)">
              <div class="flex items-start gap-3">
                <div class="text-2xl">${l.status === 'live' ? '🔴' : l.status === 'upcoming' ? '⏱️' : '✓'}</div>
                <div class="flex-1 min-w-0">
                  <h4 class="font-medium text-white truncate">${escape(l.Title || l.lecture_title || 'Lecture ' + (i+1))}</h4>
                  <p class="text-xs text-slate-400 mt-1">${l.strtotime ? new Date(l.strtotime * 1000).toLocaleString() : 'Time TBA'}</p>
                  ${l.total_video_lecture_count ? `<p class="text-xs text-slate-500 mt-1">${l.total_video_lecture_count} videos</p>` : ''}
                </div>
              </div>
            </div>
          `).join('')}</div>` : '<p class="text-slate-500">No lectures available</p>'}
        </div>

        <div id="detailNotesTab" class="detail-tab-pane p-6 hidden">
          <p class="text-sm text-slate-400 mb-4">Lecture notes will appear here. Download from the lecture details.</p>
        </div>
      </div>
    </div>
  `;

  // Tab switching
  content.querySelectorAll('.detail-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.detail-tab').forEach(b => b.classList.remove('text-white', 'border-white'));
      content.querySelectorAll('.detail-tab-pane').forEach(p => p.classList.add('hidden'));
      
      btn.classList.add('text-white', 'border-white');
      const pane = $('detail' + (btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)) + 'Tab');
      if (pane) pane.classList.remove('hidden');
    });
  });

  // Show first tab
  content.querySelector('.detail-tab')?.click();
}

async function playLecture(courseId, lectureId, element) {
  if (!lectureId) {
    showToast('Lecture details not available', 'warning');
    return;
  }

  showToast('Opening video...', 'info');
  
  // Build player URL - would need real auth in production
  const playerUrl = `https://studyapkmod-player.vercel.app/watch?course_id=${encodeURIComponent(courseId)}&lecture_id=${encodeURIComponent(lectureId)}&app=officers_academy`;
  
  // Open in new tab to player
  window.open(playerUrl, '_blank');
}

// Fallback for if APIs fail
function openBatch_legacy(batch) {
  const id = batch._id || batch.batch_id || batch.id;
  if (!id) return showToast("Course ID not found");
  window.location.href = `https://studyapkmod-live.vercel.app/?app=officers_academy&course_id=${encodeURIComponent(id)}`;
}

// Helper
function $(id) { return document.getElementById(id); }
function escape(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
