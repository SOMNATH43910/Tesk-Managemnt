package com.taskManager.taskManagement.repository;

import com.taskManager.taskManagement.model.Project;
import com.taskManager.taskManagement.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findByOwner(User owner);
    List<Project> findByStatus(Project.Status status);
}