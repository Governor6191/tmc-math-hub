let cached = null;

export async function loadCatalog(url = 'data/catalog.json', fetcher = u => fetch(u)) {
  if (cached !== null) return cached;
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`Could not load the course catalog (HTTP ${res.status})`);
  cached = await res.json();
  return cached;
}

export function resetCatalogCache() { cached = null; }

export function findCourse(catalog, courseId) {
  for (const y of catalog.years) {
    for (const s of y.semesters) {
      const course = s.courses.find(c => c.id === courseId);
      if (course) return { course, year: y.year, semester: s.semester };
    }
  }
  return null;
}

export function statsForCourses(courses) {
  const totals = { courses: courses.length, questions: 0, files: 0, topics: 0, videos: 0 };
  for (const c of courses) {
    const st = courseStats(c);
    totals.questions += st.questions;
    totals.files += st.files;
    totals.topics += st.topics;
    totals.videos += st.videos;
  }
  return totals;
}

export function semesterStats(semester) {
  return statsForCourses(semester.courses);
}

export function yearStats(year) {
  return statsForCourses(year.semesters.flatMap(s => s.courses));
}

// Distinct option streams (tracks) offered in a year, sorted. Empty for years
// without streams (Years 1 to 3).
export function yearTracks(year) {
  const set = new Set();
  for (const s of year.semesters) for (const c of s.courses) if (c.track) set.add(c.track);
  return [...set].sort();
}

// Courses a student in a given stream sees: that stream's courses plus any
// untracked (common) courses. With no track, every course is returned.
export function coursesForGroup(courses, track) {
  if (!track) return courses;
  return courses.filter(c => c.track === track || !c.track);
}

export function courseStats(course) {
  const slides = course.topics.reduce((n, t) => n + t.slides.length, 0);
  const videos = course.topics.reduce((n, t) => n + t.videos.length, 0);
  return {
    topics: course.topics.length,
    slides,
    videos,
    materials: course.materials.length,
    files: slides + course.materials.length, // YouTube videos excluded since they are not downloadable files
    questions: course.topics.reduce((n, t) => n + (t.questionCount ?? 0), 0),
  };
}
