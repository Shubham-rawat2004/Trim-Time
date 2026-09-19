package com.trimtime.system;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessResourceFailureException;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class SystemStatusControllerTest {
    @Test
    void reportsConnectedOnlyWhenTheMigrationMarkerExists() {
        var jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class))).thenReturn(1);
        assertEquals("CONNECTED", new SystemStatusController(jdbc).status().database());
    }
    @Test
    void doesNotReportHealthyWhenDatabaseIsUnavailable() {
        var jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class)))
                .thenThrow(new DataAccessResourceFailureException("private connection details"));
        assertThrows(DataAccessResourceFailureException.class, () -> new SystemStatusController(jdbc).status());
        var response = new ApiExceptionHandler().databaseUnavailable(
                new DataAccessResourceFailureException("private connection details"));
        assertEquals(503, response.getStatus());
        assertFalse(response.getDetail().contains("private"));
    }
}
