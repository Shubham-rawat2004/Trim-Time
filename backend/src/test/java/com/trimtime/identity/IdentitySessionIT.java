package com.trimtime.identity;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.util.UUID;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class IdentitySessionIT {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4.8");
    private static final Pattern TOKEN = Pattern.compile("\\\"token\\\":\\\"([^\\\"]+)\\\"");

    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @Autowired MockMvc mvc;
    @Autowired UserAccountRepository users;
    @Autowired PlatformTransactionManager transactions;

    @Test
    void authenticationRotatesTheSessionAndLogoutInvalidatesIt() throws Exception {
        var session = new MockHttpSession();
        var originalId = session.getId();
        var csrf = csrf(session);

        mvc.perform(post("/api/auth/register").session(session).cookie(csrf.cookie())
                        .header("X-XSRF-TOKEN", csrf.token()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson()))
                .andExpect(status().isCreated());

        assertNotEquals(originalId, session.getId());
        assertNotNull(session.getAttribute(SessionAuthenticationFilter.USER_ID));
        assertEquals(0, session.getAttribute(SessionAuthenticationFilter.AUTHORIZATION_VERSION));
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());

        mvc.perform(post("/api/auth/logout").session(session).cookie(csrf.cookie())
                        .header("X-XSRF-TOKEN", csrf.token()))
                .andExpect(status().isNoContent());
        assertThrows(IllegalStateException.class,
                () -> session.getAttribute(SessionAuthenticationFilter.USER_ID));
        mvc.perform(get("/api/auth/me")).andExpect(status().isForbidden());
    }

    @Test
    void roleChangesRefreshAuthoritiesAndTheStoredVersion() throws Exception {
        var session = new MockHttpSession();
        var csrf = csrf(session);
        mvc.perform(post("/api/auth/register").session(session).cookie(csrf.cookie())
                        .header("X-XSRF-TOKEN", csrf.token()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson()))
                .andExpect(status().isCreated());
        var userId = (Long) session.getAttribute(SessionAuthenticationFilter.USER_ID);

        transaction().executeWithoutResult(status ->
                users.findById(userId).orElseThrow().addRole(Role.BARBER));

        mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("BARBER")));
        assertEquals(1, session.getAttribute(SessionAuthenticationFilter.AUTHORIZATION_VERSION));
    }

    @Test
    void inactiveAccountsImmediatelyLoseTheirExistingSession() throws Exception {
        var session = new MockHttpSession();
        var csrf = csrf(session);
        mvc.perform(post("/api/auth/register").session(session).cookie(csrf.cookie())
                        .header("X-XSRF-TOKEN", csrf.token()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson()))
                .andExpect(status().isCreated());
        var userId = (Long) session.getAttribute(SessionAuthenticationFilter.USER_ID);

        transaction().executeWithoutResult(status ->
                users.findById(userId).orElseThrow().deactivate());

        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isForbidden());
        assertThrows(IllegalStateException.class,
                () -> session.getAttribute(SessionAuthenticationFilter.USER_ID));
    }

    private Csrf csrf(MockHttpSession session) throws Exception {
        var result = mvc.perform(get("/api/auth/csrf").session(session))
                .andExpect(status().isOk()).andReturn();
        var matcher = TOKEN.matcher(result.getResponse().getContentAsString());
        assertTrue(matcher.find());
        Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return new Csrf(matcher.group(1), cookie);
    }

    private String registerJson() {
        return "{\"email\":\"" + UUID.randomUUID()
                + "@example.test\",\"password\":\"ChangeMe123!\",\"displayName\":\"Session User\"}";
    }

    private TransactionTemplate transaction() { return new TransactionTemplate(transactions); }
    private record Csrf(String token, Cookie cookie) {}
}
