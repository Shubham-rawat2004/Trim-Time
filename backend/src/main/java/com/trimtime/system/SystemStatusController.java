package com.trimtime.system;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Foundation endpoint checking the actual migrated database. */
@RestController
public class SystemStatusController {
    private final JdbcTemplate jdbc;
    public SystemStatusController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/api/system/status")
    public Status status() {
        Integer marker = jdbc.queryForObject("SELECT id FROM application_metadata WHERE id = 1", Integer.class);
        if (!Integer.valueOf(1).equals(marker)) {
            throw new IllegalStateException("Foundation migration marker is missing");
        }
        return new Status("Trim-Time", "UP", "CONNECTED", "Foundation");
    }
    public record Status(String application, String status, String database, String milestone) { }
}
