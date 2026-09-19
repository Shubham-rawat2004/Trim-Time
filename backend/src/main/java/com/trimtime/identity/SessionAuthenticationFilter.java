package com.trimtime.identity;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.*;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.stereotype.Component;

@Component
public class SessionAuthenticationFilter extends OncePerRequestFilter {
    public static final String USER_ID = "trimtime.userId";
    private final UserAccountRepository users;
    public SessionAuthenticationFilter(UserAccountRepository users) { this.users = users; }
    @Override protected void doFilterInternal(HttpServletRequest request, jakarta.servlet.http.HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        var session = request.getSession(false); Object value = session == null ? null : session.getAttribute(USER_ID);
        if (value instanceof Long id) users.findById(id).filter(UserAccount::isActive).ifPresent(user -> {
            var authorities = user.getRoles().stream().map(role -> new SimpleGrantedAuthority("ROLE_" + role)).toList();
            var token = new UsernamePasswordAuthenticationToken(new UserPrincipal(user.getId(), user.getEmail()), null, authorities);
            SecurityContextHolder.getContext().setAuthentication(token);
        });
        chain.doFilter(request, response);
    }
    public record UserPrincipal(Long id, String email) implements java.security.Principal { public String getName() { return email; } }
}
