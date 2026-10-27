
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ChartNoAxesCombined,
  Settings,
  Search,
  Bell,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Menu,
  ArrowUpRight,
  BookOpen,
  UserRound,
  CheckCircle,
  CalendarCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import "./App.css";

const API_URL = "http://localhost:8080/api/students";
const ATTENDANCE_URL = "http://localhost:8080/api/attendance";
const SUBJECTS_URL = "http://localhost:8080/api/subjects";
const REQUIRED_ATTENDANCE = 75;
const todayLocal = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };

function getGrade(marks) {
  if (marks >= 90) return "A+";
  if (marks >= 80) return "A";
  if (marks >= 70) return "B";
  if (marks >= 60) return "C";
  if (marks >= 40) return "D";
  return "F";
}

function App() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All Departments");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(todayLocal());
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceDraft, setAttendanceDraft] = useState({});
  const [attendanceSummaries, setAttendanceSummaries] = useState({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    department: "Computer Science",
    year: "1st Year",
    marks: "",
  });

  async function fetchStudents() {
    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(`Could not load students (HTTP ${response.status}).`);
      }

      const data = await response.json();

      setStudents(
        data.map((student) => ({
          ...student,
          marks: Number(student.marks ?? 0),
          status: student.status ?? "Active",
        }))
      );
    } catch (error) {
      console.error("Error loading students:", error);
      setNotice("Could not load students. Check that Spring Boot is running and CORS is configured.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchSubjects() {
    try {
      const response = await fetch(SUBJECTS_URL);
      if (!response.ok) throw new Error(`Could not load subjects (HTTP ${response.status}).`);
      const data = await response.json();
      setSubjects(data);
      setSelectedSubjectId((current) => current || (data.length ? String(data[0].id) : ""));
    } catch (error) {
      console.error("Error loading subjects:", error);
      setNotice("Could not load subjects. Restart the updated Spring Boot backend.");
    }
  }

  useEffect(() => { fetchSubjects(); }, []);

  async function fetchAttendance() {
    setAttendanceLoading(true);
    try {
      if (!selectedSubjectId) { setAttendanceRecords([]); setAttendanceDraft({}); return; }
      const response = await fetch(`${ATTENDANCE_URL}?date=${attendanceDate}&subjectId=${selectedSubjectId}`);
      if (!response.ok) throw new Error(`Could not load attendance (HTTP ${response.status}).`);
      const records = await response.json();
      setAttendanceRecords(records);
      const drafts = {};
      records.forEach((record) => { drafts[String(record.studentId)] = record.status; });
      setAttendanceDraft((previous) => {
        const next = { ...previous };
        students.forEach((student) => {
          if (drafts[String(student.id)] !== undefined) next[String(student.id)] = drafts[String(student.id)];
          else delete next[String(student.id)];
        });
        return next;
      });
    } catch (error) {
      console.error("Error loading attendance:", error);
      setNotice("Could not load attendance. Check that the Spring Boot attendance API is running.");
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function fetchAttendanceSummaries() {
    if (!students.length) { setAttendanceSummaries({}); return; }
    const entries = await Promise.all(students.map(async (student) => {
      try {
        if (!selectedSubjectId) return [String(student.id), null];
        const response = await fetch(`${ATTENDANCE_URL}/student/${student.id}/subject/${selectedSubjectId}/summary`);
        if (!response.ok) return [String(student.id), null];
        return [String(student.id), await response.json()];
      } catch {
        return [String(student.id), null];
      }
    }));
    setAttendanceSummaries(Object.fromEntries(entries));
  }

  useEffect(() => {
    if (students.length) fetchAttendanceSummaries();
    else setAttendanceSummaries({});
  }, [students, selectedSubjectId]);

  useEffect(() => {
    fetchAttendance();
  }, [attendanceDate, students, selectedSubjectId]);

  async function saveAttendance() {
    const selected = students.filter((student) => ["PRESENT", "ABSENT", "ON_LEAVE"].includes(attendanceDraft[String(student.id)]));
    if (!selected.length) {
      setNotice("Choose an attendance status for at least one student before saving.");
      return;
    }
    setAttendanceSaving(true);
    try {
      for (const student of selected) {
        const response = await fetch(ATTENDANCE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: student.id,
            subjectId: Number(selectedSubjectId),
            attendanceDate,
            status: attendanceDraft[String(student.id)],
          }),
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `Failed to save attendance for ${student.name}.`);
        }
      }
      setNotice(`Attendance saved for ${selected.length} student${selected.length === 1 ? "" : "s"} in ${subjects.find((subject) => String(subject.id) === String(selectedSubjectId))?.name || "the selected subject"} on ${attendanceDate}.`);
      await fetchAttendance();
      await fetchAttendanceSummaries();
    } catch (error) {
      console.error("Error saving attendance:", error);
      setNotice(error.message || "Could not save attendance. Check the backend connection.");
    } finally {
      setAttendanceSaving(false);
    }
  }

  const markedToday = attendanceRecords.length;
  const presentToday = attendanceRecords.filter((record) => record.status === "PRESENT").length;
  const absentToday = attendanceRecords.filter((record) => record.status === "ABSENT").length;
  const attendanceShortage = students.filter((student) => {
    const summary = attendanceSummaries[String(student.id)];
    return summary && summary.classesHeld > 0 && Number(summary.percentage) < REQUIRED_ATTENDANCE;
  }).length;

  const activeStudents = students.filter((student) => student.status === "Active").length;
  const average = students.length
    ? Math.round(students.reduce((sum, student) => sum + student.marks, 0) / students.length)
    : 0;
  const passRate = students.length
    ? Math.round((students.filter((student) => student.marks >= 40).length / students.length) * 100)
    : 0;

  // These analytics are calculated from the student records returned by the API.
  const departmentPerformance = Object.values(
    students.reduce((groups, student) => {
      const name = student.department || "Unassigned";
      if (!groups[name]) groups[name] = { department: name, totalMarks: 0, count: 0 };
      groups[name].totalMarks += Number(student.marks) || 0;
      groups[name].count += 1;
      return groups;
    }, {})
  ).map((group) => ({
    department: group.department.length > 13
      ? `${group.department.slice(0, 12)}…`
      : group.department,
    average: Math.round(group.totalMarks / group.count),
    students: group.count,
  }));

  const marksDistribution = [
    { range: "0–39", count: students.filter((student) => student.marks < 40).length },
    { range: "40–59", count: students.filter((student) => student.marks >= 40 && student.marks < 60).length },
    { range: "60–79", count: students.filter((student) => student.marks >= 60 && student.marks < 80).length },
    { range: "80–100", count: students.filter((student) => student.marks >= 80).length },
  ];

  const passFailData = [
    { name: "Passed", value: students.filter((student) => student.marks >= 40).length },
    { name: "Needs support", value: students.filter((student) => student.marks < 40).length },
  ].filter((item) => item.value > 0);

  const topPerformer = students.length
    ? students.reduce((best, student) => student.marks > best.marks ? student : best, students[0])
    : null;

  const studentsNeedingSupport = students.filter((student) => student.marks < 40).length;

  const filteredStudents = students.filter((student) => {
    const matchesSearch = `${student.name} ${student.id} ${student.email}`
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesDepartment =
      department === "All Departments" || student.department === department;

    return matchesSearch && matchesDepartment;
  });

  function openAddForm() {
    setEditingId(null);
    setForm({
      name: "",
      email: "",
      department: "Computer Science",
      year: "1st Year",
      marks: "",
    });
    setShowForm(true);
  }

  function openEditForm(student) {
    setEditingId(student.id);
    setForm({
      name: student.name,
      email: student.email,
      department: student.department,
      year: student.year,
      marks: String(student.marks),
    });
    setShowForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const marks = Number(form.marks);

    if (!form.name.trim() || !form.email.trim()) {
      setNotice("Please enter the student's name and email.");
      return;
    }

    if (!Number.isFinite(marks) || marks < 0 || marks > 100) {
      setNotice("Marks must be between 0 and 100.");
      return;
    }

    const studentData = {
      name: form.name.trim(),
      email: form.email.trim(),
      department: form.department,
      year: form.year,
      marks,
    };

    const isEditing = editingId !== null;

    try {
      const response = await fetch(
        isEditing ? `${API_URL}/${editingId}` : API_URL,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(studentData),
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Could not save student (HTTP ${response.status}).`);
      }

      await fetchStudents();
      setShowForm(false);
      setEditingId(null);
      setNotice(isEditing ? "Student record updated successfully." : "Student added successfully.");
    } catch (error) {
      console.error("Error saving student:", error);
      setNotice(error.message || "Could not save student. Check the backend connection.");
    }
  }

  async function deleteStudent(id) {
    const student = students.find((item) => String(item.id) === String(id));
    if (!student) return;

    if (!window.confirm(`Delete ${student.name}'s record?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Could not delete student (HTTP ${response.status}).`);
      }

      await fetchStudents();
      setNotice("Student record deleted successfully.");
    } catch (error) {
      console.error("Error deleting student:", error);
      setNotice(error.message || "Could not delete student. Check the backend connection.");
    }
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><GraduationCap size={25} /></div>
          <div>
            <h2>Balaji</h2>
            <span>STUDENT PORTAL</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={19} />
          </button>
        </div>

        <div className="nav-caption">WORKSPACE</div>

        <nav className="navigation">
          <button className="nav-item active" onClick={() => setSidebarOpen(false)}>
            <LayoutDashboard size={19} /> <span>Dashboard</span>
          </button>
          <button
            className="nav-item"
            onClick={() => {
              document.getElementById("students-section")?.scrollIntoView({ behavior: "smooth" });
              setSidebarOpen(false);
            }}
          >
            <Users size={19} /> <span>Students</span>
            <span className="nav-count">{students.length}</span>
          </button>
          <button
            className="nav-item"
            onClick={() => {
              setNotice("Academic results are shown in the student records table.");
              setSidebarOpen(false);
            }}
          >
            <BookOpen size={19} /> <span>Academics</span>
          </button>
          <button
            className="nav-item"
            onClick={() => {
              document.getElementById("analytics-section")?.scrollIntoView({ behavior: "smooth" });
              setSidebarOpen(false);
            }}
          >
            <ChartNoAxesCombined size={19} /> <span>Analytics</span>
          </button>
          <button
            className="nav-item"
            onClick={() => {
              document.getElementById("attendance-section")?.scrollIntoView({ behavior: "smooth" });
              setSidebarOpen(false);
            }}
          >
            <CalendarCheck size={19} /> <span>Attendance</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="nav-caption">PREFERENCES</div>
          <button className="nav-item" onClick={() => setNotice("Settings will be available in a future version.")}>
            <Settings size={19} /> <span>Settings</span>
          </button>

          <div className="sidebar-card">
            <div className="sidebar-card-icon"><GraduationCap size={21} /></div>
            <h3>Keep growing!</h3>
            <p>Every student has the potential to achieve something great.</p>
          </div>

          <div className="profile">
            <div className="avatar admin-avatar">AD</div>
            <div className="profile-details">
              <strong>Administrator</strong>
              <span>Admin account</span>
            </div>
            <MoreHorizontal size={20} className="profile-more" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>Dashboard</strong></div>
          <div className="topbar-actions">
            <span className="today-label">Academic Overview</span>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotice("You're all caught up!")}>
              <Bell size={19} /><span className="notification-dot" />
            </button>
            <div className="avatar top-avatar">AD</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-section">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> MANAGEMENT OVERVIEW</div>
              <h1>Good day, Administrator <span className="wave">✦</span></h1>
              <p>Here's what's happening with your students today.</p>
            </div>
            <button className="primary-button" onClick={openAddForm}>
              <Plus size={18} /> Add New Student
            </button>
          </section>

          {notice && (
            <div className="notice" role="status">
              <CheckCircle size={18} />
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={17} /></button>
            </div>
          )}

          <section className="stats-grid">
            <article className="stat-card">
              <div className="stat-top">
                <div className="stat-icon students-icon"><Users size={21} /></div>
                <span className="stat-badge neutral-badge">ENROLMENT</span>
              </div>
              <p className="stat-label">Total Students</p>
              <div className="stat-value-row">
                <h2>{students.length}</h2>
                <span className="stat-trend"><ArrowUpRight size={15} /> Records</span>
              </div>
              <div className="stat-footer"><span className="mini-bar"><i style={{ width: "76%" }} /></span><span>Student records</span></div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <div className="stat-icon active-icon"><UserRound size={21} /></div>
                <span className="stat-badge green-badge">ACTIVE</span>
              </div>
              <p className="stat-label">Active Students</p>
              <div className="stat-value-row">
                <h2>{activeStudents}</h2>
                <span className="stat-trend positive-trend"><ArrowUpRight size={15} /> Enrolled</span>
              </div>
              <div className="stat-footer"><span className="mini-bar green-bar"><i style={{ width: `${students.length ? (activeStudents / students.length) * 100 : 0}%` }} /></span><span>Currently active</span></div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <div className="stat-icon average-icon"><ChartNoAxesCombined size={21} /></div>
                <span className="stat-badge purple-badge">ACADEMICS</span>
              </div>
              <p className="stat-label">Average Percentage</p>
              <div className="stat-value-row">
                <h2>{average}<small>%</small></h2>
                <span className="stat-trend positive-trend"><ArrowUpRight size={15} /> Average</span>
              </div>
              <div className="stat-footer"><span className="mini-bar purple-bar"><i style={{ width: `${average}%` }} /></span><span>Across all records</span></div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <div className="stat-icon pass-icon"><GraduationCap size={21} /></div>
                <span className="stat-badge green-badge">PERFORMANCE</span>
              </div>
              <p className="stat-label">Pass Rate</p>
              <div className="stat-value-row">
                <h2>{passRate}<small>%</small></h2>
                <span className="stat-trend positive-trend"><ArrowUpRight size={15} /> Passing</span>
              </div>
              <div className="stat-footer"><span className="mini-bar green-bar"><i style={{ width: `${passRate}%` }} /></span><span>Marks of 40% or higher</span></div>
            </article>
          </section>

          <section className="insight-banner">
            <div className="insight-symbol"><GraduationCap size={24} /></div>
            <div className="insight-copy">
              <strong>Education is an investment in the future.</strong>
              <span>Keep student information organized and academic progress visible, all in one place.</span>
            </div>
            <div className="insight-decoration">EDU<span>+</span></div>
          </section>



          <section id="attendance-section" style={{ margin: "28px 0 34px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
              <div>
                <div className="section-kicker">SUBJECT-WISE DAILY CLASS REGISTER</div>
                <h2 style={{ margin: "6px 0", color: "#172b4d", fontSize: "clamp(22px, 2.2vw, 28px)" }}>Student Attendance</h2>
                <p style={{ margin: 0, color: "#8190aa", fontSize: 14 }}>Minimum attendance requirement: {REQUIRED_ATTENDANCE}%.</p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#71809a", fontSize: 12, fontWeight: 700 }}>
                  SUBJECT
                  <select value={selectedSubjectId} onChange={(event) => { setSelectedSubjectId(event.target.value); setAttendanceDraft({}); }} style={{ minWidth: 220, border: "1px solid #e1e8f2", borderRadius: 10, padding: "10px 12px", color: "#243653", background: "white" }}>
                    {subjects.length === 0 && <option value="">No subjects available</option>}
                    {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#71809a", fontSize: 12, fontWeight: 700 }}>
                  ATTENDANCE DATE
                  <input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} style={{ border: "1px solid #e1e8f2", borderRadius: 10, padding: "10px 12px", color: "#243653", background: "white" }} />
                </label>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 18 }}>
              {[
                { label: "Marked for date", value: markedToday, color: "#4968f7" },
                { label: "Present", value: presentToday, color: "#059669" },
                { label: "Absent", value: absentToday, color: "#dc2626" },
                { label: "Below 75%", value: attendanceShortage, color: "#d97706" },
              ].map((item) => (
                <article key={item.label} style={{ background: "white", border: "1px solid #e8edf5", borderRadius: 14, padding: 18 }}>
                  <div style={{ color: "#8190aa", fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: item.color, marginTop: 6 }}>{item.value}</div>
                </article>
              ))}
            </div>

            <div style={{ background: "white", border: "1px solid #e8edf5", borderRadius: 18, overflow: "hidden", boxShadow: "0 5px 18px rgba(31, 50, 90, 0.035)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #edf1f7", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: 0, color: "#243653", fontSize: 16 }}>Mark daily attendance — {subjects.find((subject) => String(subject.id) === String(selectedSubjectId))?.name || "Select a subject"}</h3>
                  <p style={{ margin: "5px 0 0", color: "#8a97ad", fontSize: 12 }}>Choose a status for each student for this subject and date. On Leave is excluded from classes held.</p>
                </div>
                <button className="primary-button" onClick={saveAttendance} disabled={attendanceSaving || attendanceLoading || !students.length || !selectedSubjectId}>
                  <CheckCircle size={17} /> {attendanceSaving ? "Saving..." : "Save Attendance"}
                </button>
              </div>
              {attendanceLoading ? <div style={{ padding: 28, color: "#8190aa" }}>Loading attendance...</div> : students.length === 0 ? (
                <div style={{ padding: 28, color: "#8190aa" }}>Add students first. Attendance can be marked after student records exist.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                    <thead><tr style={{ background: "#f8fafd", color: "#8190aa", fontSize: 10, letterSpacing: 1 }}>
                      <th style={{ padding: 14, textAlign: "left" }}>STUDENT</th><th style={{ padding: 14, textAlign: "left" }}>DEPARTMENT</th><th style={{ padding: 14, textAlign: "left" }}>STATUS FOR SUBJECT / DATE</th><th style={{ padding: 14, textAlign: "left" }}>SUBJECT ATTENDANCE</th>
                    </tr></thead>
                    <tbody>{students.map((student) => {
                      const summary = attendanceSummaries[String(student.id)];
                      const status = attendanceDraft[String(student.id)] || "";
                      const percentage = summary ? Number(summary.percentage) : 0;
                      return <tr key={student.id} style={{ borderTop: "1px solid #edf1f7" }}>
                        <td style={{ padding: 14 }}><strong style={{ display: "block", color: "#243653" }}>{student.name}</strong><span style={{ color: "#8a97ad", fontSize: 12 }}>{student.email}</span></td>
                        <td style={{ padding: 14, color: "#71809a", fontSize: 13 }}>{student.department}</td>
                        <td style={{ padding: 14 }}><select aria-label={`Attendance status for ${student.name}`} value={status} onChange={(event) => setAttendanceDraft((previous) => ({ ...previous, [String(student.id)]: event.target.value }))} style={{ border: "1px solid #e1e8f2", borderRadius: 9, padding: "9px 10px", color: "#243653", background: "white", minWidth: 140 }}>
                          <option value="">Select status</option><option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="ON_LEAVE">On Leave</option>
                        </select></td>
                        <td style={{ padding: 14, minWidth: 170 }}>
                          {summary && summary.classesHeld > 0 ? <><strong style={{ color: percentage >= REQUIRED_ATTENDANCE ? "#059669" : "#dc2626" }}>{percentage.toFixed(2)}%</strong><div style={{ height: 5, background: "#edf1f7", borderRadius: 5, marginTop: 7, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, percentage)}%`, background: percentage >= REQUIRED_ATTENDANCE ? "#10b981" : "#ef4444" }} /></div><span style={{ fontSize: 11, color: percentage >= REQUIRED_ATTENDANCE ? "#059669" : "#dc2626" }}>{percentage >= REQUIRED_ATTENDANCE ? "Eligible" : "Below 75%"} · {summary.present}/{summary.classesHeld} classes</span></> : <span style={{ color: "#8a97ad", fontSize: 12 }}>No classes recorded</span>}
                        </td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
              )}
              <div style={{ padding: "12px 20px", borderTop: "1px solid #edf1f7", color: "#8a97ad", fontSize: 12 }}>Attendance percentages apply only to the selected subject and update after saving. A student with no recorded classes has no eligibility decision yet.</div>
            </div>
          </section>

          <section id="analytics-section" style={{ margin: "28px 0 34px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
              <div>
                <div className="section-kicker">DATA & INSIGHTS</div>
                <h2 style={{ margin: "6px 0", color: "#172b4d", fontSize: "clamp(22px, 2.2vw, 28px)" }}>Academic Analytics</h2>
                <p style={{ margin: 0, color: "#8190aa", fontSize: 14 }}>Performance insights calculated from your student records.</p>
              </div>
              <span style={{ background: "#e9f8f1", color: "#07845b", padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                {students.length} RECORD{students.length === 1 ? "" : "S ANALYZED"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
              <article style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 18, padding: 20, minWidth: 0, boxShadow: "0 5px 18px rgba(31, 50, 90, 0.035)" }}>
                <h3 style={{ margin: "0 0 4px", color: "#243653", fontSize: 16 }}>Average Marks by Department</h3>
                <p style={{ margin: "0 0 18px", color: "#8a97ad", fontSize: 12 }}>Average score out of 100</p>
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentPerformance} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f7" />
                      <XAxis dataKey="department" tick={{ fontSize: 10, fill: "#71809a" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#71809a" }} />
                      <Tooltip formatter={(value) => [`${value}%`, "Average marks"]} />
                      <Bar dataKey="average" name="Average marks" fill="#4968f7" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {!students.length && <p style={{ textAlign: "center", color: "#8a97ad", fontSize: 12, margin: 0 }}>Add students to see department performance.</p>}
              </article>

              <article style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 18, padding: 20, minWidth: 0, boxShadow: "0 5px 18px rgba(31, 50, 90, 0.035)" }}>
                <h3 style={{ margin: "0 0 4px", color: "#243653", fontSize: 16 }}>Marks Distribution</h3>
                <p style={{ margin: "0 0 18px", color: "#8a97ad", fontSize: 12 }}>Number of students in each score range</p>
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marksDistribution} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f7" />
                      <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#71809a" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#71809a" }} />
                      <Tooltip formatter={(value) => [value, "Students"]} />
                      <Bar dataKey="count" name="Students" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 18, padding: 20, minWidth: 0, boxShadow: "0 5px 18px rgba(31, 50, 90, 0.035)" }}>
                <h3 style={{ margin: "0 0 4px", color: "#243653", fontSize: 16 }}>Pass vs. Needs Support</h3>
                <p style={{ margin: "0 0 8px", color: "#8a97ad", fontSize: 12 }}>Passing threshold: 40 marks</p>
                {passFailData.length ? (
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={passFailData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={78} innerRadius={48} paddingAngle={3}>
                          {passFailData.map((entry, index) => <Cell key={entry.name} fill={index === 0 ? "#10b981" : "#f59e0b"} />)}
                        </Pie>
                        <Tooltip formatter={(value) => [value, "Students"]} />
                        <Legend verticalAlign="bottom" iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ height: 250, display: "grid", placeItems: "center", color: "#8a97ad", fontSize: 13, textAlign: "center" }}>
                    Add student records to see pass/fail analytics.
                  </div>
                )}
              </article>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginTop: 18 }}>
              <article style={{ background: "linear-gradient(135deg, #202f57, #344a7c)", borderRadius: 18, padding: 22, color: "#fff" }}>
                <div style={{ fontSize: 11, letterSpacing: 1.5, opacity: 0.75, fontWeight: 700 }}>TOP PERFORMER</div>
                {topPerformer ? (
                  <>
                    <h3 style={{ fontSize: 21, margin: "12px 0 5px" }}>{topPerformer.name}</h3>
                    <p style={{ margin: 0, opacity: 0.8, fontSize: 13 }}>{topPerformer.department} · {topPerformer.year}</p>
                    <div style={{ fontSize: 32, fontWeight: 800, marginTop: 16 }}>{topPerformer.marks}% <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>score</span></div>
                  </>
                ) : <p style={{ marginBottom: 0, opacity: 0.8 }}>Student performance will appear here once records are added.</p>}
              </article>
              <article style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 18, padding: 22 }}>
                <div style={{ fontSize: 11, letterSpacing: 1.5, color: "#8a97ad", fontWeight: 700 }}>ACADEMIC SUPPORT</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#172b4d", marginTop: 12 }}>{studentsNeedingSupport}</div>
                <h3 style={{ fontSize: 15, margin: "2px 0 8px", color: "#243653" }}>Students below 40 marks</h3>
                <p style={{ margin: 0, color: "#8a97ad", fontSize: 13 }}>These records may need additional academic support.</p>
              </article>
            </div>
          </section>

          <section className="students-section" id="students-section">
            <div className="section-heading">
              <div>
                <div className="section-kicker">YOUR DIRECTORY</div>
                <h2>Student Directory <span className="record-count">{students.length}</span></h2>
                <p>Manage student profiles and academic performance.</p>
              </div>
              <button className="secondary-button" onClick={openAddForm}>
                <Plus size={17} /> Add Student
              </button>
            </div>

            <div className="table-card">
              <div className="table-toolbar">
                <div className="table-title">
                  <h3>All Students</h3>
                  <span>{filteredStudents.length} records</span>
                </div>
                <div className="table-filters">
                  <label className="search-box">
                    <Search size={17} />
                    <input
                      type="search"
                      placeholder="Search students..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter by department">
                    <option>All Departments</option>
                    <option>Computer Science</option>
                    <option>Information Technology</option>
                    <option>Electronics</option>
                    <option>Mechanical</option>
                  </select>
                </div>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>STUDENT</th>
                      <th>STUDENT ID</th>
                      <th>DEPARTMENT</th>
                      <th>YEAR</th>
                      <th>MARKS</th>
                      <th>GRADE</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan="8" className="empty-state">Loading student records...</td>
                      </tr>
                    )}
                    {!loading && filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td>
                          <div className="student-cell">
                            <div className={`avatar student-avatar avatar-${student.name.length % 5}`}>
                              {student.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                            </div>
                            <div className="student-info">
                              <strong>{student.name}</strong>
                              <span>{student.email}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className="student-id">{student.id}</span></td>
                        <td><span className="department-text">{student.department}</span></td>
                        <td>{student.year}</td>
                        <td>
                          <div className="marks-cell">
                            <div className="marks-track"><span style={{ width: `${student.marks}%` }} /></div>
                            <span>{student.marks}%</span>
                          </div>
                        </td>
                        <td><span className={`grade grade-${getGrade(student.marks).replace("+", "plus")}`}>{getGrade(student.marks)}</span></td>
                        <td><span className={`status status-${student.status.toLowerCase()}`}><i />{student.status}</span></td>
                        <td>
                          <div className="action-buttons">
                            <button className="action-button edit-action" onClick={() => openEditForm(student)} aria-label={`Edit ${student.name}`} title="Edit student"><Pencil size={16} /></button>
                            <button className="action-button delete-action" onClick={() => deleteStudent(student.id)} aria-label={`Delete ${student.name}`} title="Delete student"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!loading && filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan="8" className="empty-state">
                          <Users size={30} />
                          <strong>No students found</strong>
                          <span>Try a different search or add a student record.</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-footer">
                <span>Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> students</span>
                <span className="footer-secure"><CheckCircle size={15} /> Student records overview</span>
              </div>
            </div>
          </section>

          <footer className="footer">
            <span>© 2026 EduManage Student Portal</span>
            <span>Built with <strong>React</strong> · Student Management System</span>
          </footer>
        </div>
      </main>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <section
            className="student-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-form-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="section-kicker">{editingId ? "UPDATE RECORD" : "NEW ENROLMENT"}</span>
                <h2 id="student-form-title">{editingId ? "Edit Student" : "Add New Student"}</h2>
                <p>Enter the student's information below.</p>
              </div>
              <button className="modal-close" onClick={() => setShowForm(false)} aria-label="Close form"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Full Name *</span>
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Enter full name" />
              </label>

              <label className="form-field">
                <span>Email Address *</span>
                <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="student@example.com" />
              </label>

              <div className="form-row">
                <label className="form-field">
                  <span>Department</span>
                  <select value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}>
                    <option>Computer Science</option>
                    <option>Information Technology</option>
                    <option>Electronics</option>
                    <option>Mechanical</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Academic Year</span>
                  <select value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })}>
                    <option>1st Year</option>
                    <option>2nd Year</option>
                    <option>3rd Year</option>
                    <option>4th Year</option>
                  </select>
                </label>
              </div>

              <label className="form-field">
                <span>Percentage / Marks (0–100) *</span>
                <input required type="number" min="0" max="100" step="0.01" value={form.marks} onChange={(event) => setForm({ ...form, marks: event.target.value })} placeholder="Enter marks" />
              </label>

              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-button"><Plus size={17} /> {editingId ? "Save Changes" : "Add Student"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
