package com.trimtime.identity;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Locale;

@Service
public class AuthService {
    private final UserAccountRepository users;
    private final PasswordEncoder passwords;
    public AuthService(UserAccountRepository users, PasswordEncoder passwords) {
        this.users = users; this.passwords = passwords;
    }
    @Transactional
    public UserAccount register(AuthDtos.RegisterRequest request) {
        var email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmail(email)) throw new DuplicateEmailException();
        try { return users.save(new UserAccount(email, passwords.encode(request.password()), request.displayName().trim())); }
        catch (DataIntegrityViolationException ex) { throw new DuplicateEmailException(); }
    }
    public UserAccount authenticate(AuthDtos.LoginRequest request) {
        var email = request.email().trim().toLowerCase(Locale.ROOT);
        var user = users.findByEmail(email).orElseThrow(InvalidCredentialsException::new);
        if (!user.isActive() || !passwords.matches(request.password(), user.getPasswordHash())) throw new InvalidCredentialsException();
        return user;
    }
    public static class DuplicateEmailException extends RuntimeException { }
    public static class InvalidCredentialsException extends RuntimeException { }
}
