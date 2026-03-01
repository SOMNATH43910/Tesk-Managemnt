package com.taskManager.taskManagement.repository;

import com.taskManager.taskManagement.model.Task;
import com.taskManager.taskManagement.model.User;
import com.taskManager.taskManagement.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByProject(Project project);
    List<Task> findByAssignee(User assignee);
    List<Task> findByStatus(Task.Status status);
    List<Task> findByPriority(Task.Priority priority);
}