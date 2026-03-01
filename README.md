<div align="center">

<!-- ANIMATED HEADER -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f2027,30:1a1a2e,60:16213e,100:0f3460&height=300&section=header&text=TaskFlow&fontSize=90&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Real-Time%20Collaborative%20Task%20Manager&descAlignY=58&descSize=22&descColor=a8d8ea"/>

<!-- TYPING ANIMATION -->
<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&duration=3000&pause=800&color=00D9FF&center=true&vCenter=true&multiline=false&width=750&height=50&lines=⚡+Real-Time+Collaborative+Task+Manager;🎯+Jira+%2B+Trello+Experience+—+Built+from+Scratch;🔐+Role-Based+Access+Control+(Admin%2FManager%2FDev);🌐+Spring+Boot+%2B+WebSocket+%2B+React;🚀+Built+by+Your+Name+Here"/>

<br/>

<!-- BADGES -->
<p>
<img src="https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge&logo=checkmarx&logoColor=white&labelColor=0d1117"/>
<img src="https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge&logo=semver&logoColor=white&labelColor=0d1117"/>
<img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge&logo=opensourceinitiative&logoColor=white&labelColor=0d1117"/>
<img src="https://img.shields.io/badge/PRs-Welcome-ff69b4?style=for-the-badge&logo=github&logoColor=white&labelColor=0d1117"/>
<img src="https://img.shields.io/badge/Java-21-orange?style=for-the-badge&logo=openjdk&logoColor=white&labelColor=0d1117"/>
</p>

</div>

---

## <img src="https://media2.giphy.com/media/QssGEmpkyEOhBCb7e1/giphy.gif?cid=ecf05e47a0n3gi1bfqntqmob8g9aid1oyj2wr3ds3mg700bl&rid=giphy.gif" width="28"> Tech Stack

<div align="center">

<table>
<tr>
<td align="center" width="130">
<img src="https://skillicons.dev/icons?i=spring" width="48" height="48" alt="Spring Boot"/><br/>
<sub><b>Spring Boot 3.5</b></sub>
</td>
<td align="center" width="130">
<img src="https://skillicons.dev/icons?i=react" width="48" height="48" alt="React"/><br/>
<sub><b>React</b></sub>
</td>
<td align="center" width="130">
<img src="https://skillicons.dev/icons?i=postgresql" width="48" height="48" alt="PostgreSQL"/><br/>
<sub><b>PostgreSQL</b></sub>
</td>
<td align="center" width="130">
<img src="https://skillicons.dev/icons?i=java" width="48" height="48" alt="Java"/><br/>
<sub><b>Java 21</b></sub>
</td>
<td align="center" width="130">
<img src="https://skillicons.dev/icons?i=maven" width="48" height="48" alt="Maven"/><br/>
<sub><b>Maven</b></sub>
</td>
<td align="center" width="130">
<img src="https://skillicons.dev/icons?i=docker" width="48" height="48" alt="Docker"/><br/>
<sub><b>Docker</b></sub>
</td>
</tr>
</table>

<br/>

![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.5.11-6DB33F?style=flat-square&logo=springboot&logoColor=white)
![Spring Security](https://img.shields.io/badge/Spring_Security-6DB33F?style=flat-square&logo=springsecurity&logoColor=white)
![Spring Data JPA](https://img.shields.io/badge/Spring_Data_JPA-6DB33F?style=flat-square&logo=spring&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-STOMP-00B4D8?style=flat-square&logo=socket.io&logoColor=white)
![Lombok](https://img.shields.io/badge/Lombok-BC4521?style=flat-square&logo=lombok&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)

</div>

---

## ✨ Features

<div align="center">

| Feature | Description |
|--------|-------------|
| 🔴 **Real-Time Collaboration** | Live task updates via WebSocket (STOMP protocol) |
| 🔐 **Role-Based Access Control** | Admin / Manager / Developer roles via Spring Security |
| 📋 **Project & Task Management** | Full CRUD — create, assign, prioritize, track |
| ⏰ **Deadlines & Priorities** | Set HIGH / MEDIUM / LOW priority with due dates |
| 🔔 **Live Notifications** | Instant WebSocket push notifications to all team members |
| 📊 **Dashboard Analytics** | Visual charts for task status, project progress |
| 🌐 **REST APIs** | Clean, documented REST endpoints |
| 🏗️ **Scalable Architecture** | Layered architecture — Controller → Service → Repository |

</div>

---

## 🏗️ Project Structure

```
src/main/java/com/taskManager/task_management/
├── config/
│   ├── SecurityConfig.java          # JWT + Role-based auth config
│   └── WebSocketConfig.java         # STOMP WebSocket config
├── model/
│   ├── User.java                    # User entity (Admin/Manager/Developer)
│   ├── Project.java                 # Project entity
│   └── Task.java                    # Task entity (priority, deadline, status)
├── repository/
│   ├── UserRepository.java
│   ├── ProjectRepository.java
│   └── TaskRepository.java
├── service/
│   ├── UserService.java
│   ├── ProjectService.java
│   └── TaskService.java
└── controller/
    ├── UserController.java          # Auth + user management endpoints
    ├── ProjectController.java       # Project CRUD endpoints
    ├── TaskController.java          # Task CRUD endpoints
    └── WebSocketController.java     # Real-time event broadcasting
```

---

## 🚀 Getting Started

### Prerequisites

- Java 21+
- Maven 3.8+
- PostgreSQL 14+
- Node.js 18+ *(for frontend)*

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/task-management.git
cd task-management
```

### 2. Configure Database

Edit `src/main/resources/application.properties`:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/taskmanager_db
spring.datasource.username=your_username
spring.datasource.password=your_password
spring.jpa.hibernate.ddl-auto=update
```

### 3. Run the Backend

```bash
mvn clean install
mvn spring-boot:run
```

> Backend runs on: `http://localhost:8080`

### 4. Run the Frontend *(React)*

```bash
cd frontend
npm install
npm start
```

> Frontend runs on: `http://localhost:3000`

---

## 🔌 API Endpoints

### 👤 User APIs

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Register new user | Public |
| `POST` | `/api/auth/login` | Login & get JWT | Public |
| `GET` | `/api/users` | Get all users | Admin |
| `DELETE` | `/api/users/{id}` | Delete user | Admin |

### 📁 Project APIs

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/projects` | Get all projects | All |
| `POST` | `/api/projects` | Create project | Admin/Manager |
| `PUT` | `/api/projects/{id}` | Update project | Admin/Manager |
| `DELETE` | `/api/projects/{id}` | Delete project | Admin |

### ✅ Task APIs

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/tasks` | Get all tasks | All |
| `POST` | `/api/tasks` | Create task | Manager |
| `PUT` | `/api/tasks/{id}` | Update task | Assigned User |
| `DELETE` | `/api/tasks/{id}` | Delete task | Admin/Manager |
| `PATCH` | `/api/tasks/{id}/assign` | Assign task to user | Manager |

### 🔴 WebSocket Events

| Topic | Event | Description |
|-------|-------|-------------|
| `/topic/tasks` | `TASK_UPDATED` | Broadcast when task changes |
| `/topic/notifications` | `NOTIFICATION` | Live notification to team |
| `/app/task.update` | Client → Server | User updates a task |

---

## 🔐 Role-Based Access Control

```
👑 ADMIN
 ├── Full access to everything
 ├── Manage users & roles
 └── Delete projects/tasks

👔 MANAGER
 ├── Create & manage projects
 ├── Assign tasks to developers
 └── View all tasks & analytics

💻 DEVELOPER
 ├── View assigned tasks
 ├── Update task status
 └── Receive live notifications
```

---

## 🗄️ Database Schema

```
Users ──< Projects (many-to-many via user_projects)
Projects ──< Tasks
Tasks >── Users (assigned_to)

Task Status:  TODO | IN_PROGRESS | REVIEW | DONE
Priority:     HIGH | MEDIUM | LOW
```

---

## 📸 Screenshots

> *Coming soon — Dashboard, Task Board, Real-time notifications*
---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

```bash
# Fork the repo
# Create your feature branch
git checkout -b feature/AmazingFeature

# Commit changes
git commit -m "Add AmazingFeature"

# Push to branch
git push origin feature/AmazingFeature

# Open a Pull Request
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f3460,50:16213e,100:0f2027&height=120&section=footer"/>

**Made with ❤️ by [Your Name](https://github.com/your-username)**

⭐ Star this repo if you found it helpful!

</div>
