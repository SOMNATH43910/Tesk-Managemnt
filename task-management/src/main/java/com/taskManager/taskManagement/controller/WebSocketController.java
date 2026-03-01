package com.taskManager.taskManagement.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class WebSocketController {

    @MessageMapping("/task.update")
    @SendTo("/topic/tasks")
    public String taskUpdated(String message) {
        return "Task updated: " + message;
    }

    @MessageMapping("/project.update")
    @SendTo("/topic/projects")
    public String projectUpdated(String message) {
        return "Project updated: " + message;
    }
}