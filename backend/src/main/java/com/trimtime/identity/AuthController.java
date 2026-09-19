package com.trimtime.identity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.web.csrf.CsrfToken;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final UserAccountRepository users;
    public AuthController(AuthService auth, UserAccountRepository users) { this.auth = auth; this.users = users; }
    @GetMapping("/csrf")
    public CsrfToken csrf(CsrfToken token) { return token; }
    @PostMapping("/register")
    public ResponseEntity<AuthDtos.UserResponse> register(@Valid @RequestBody AuthDtos.RegisterRequest request, HttpServletRequest servletRequest) {
        var user = auth.register(request);
        servletRequest.getSession(true).setAttribute(SessionAuthenticationFilter.USER_ID, user.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(user));
    }
    @PostMapping("/login")
    public AuthDtos.UserResponse login(@Valid @RequestBody AuthDtos.LoginRequest request, HttpServletRequest servletRequest) {
        var user = auth.authenticate(request);
        servletRequest.getSession(true).setAttribute(SessionAuthenticationFilter.USER_ID, user.getId());
        return toResponse(user);
    }
    @GetMapping("/me")
    public AuthDtos.UserResponse me() {
        var principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        var user = users.findById(((SessionAuthenticationFilter.UserPrincipal) principal).id()).orElseThrow();
        return toResponse(user);
    }
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        var session = request.getSession(false); if (session != null) session.invalidate();
        SecurityContextHolder.clearContext(); return ResponseEntity.noContent().build();
    }
    private AuthDtos.UserResponse toResponse(UserAccount user) { return new AuthDtos.UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getRoles()); }
}
