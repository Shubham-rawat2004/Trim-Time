package com.trimtime.identity;

import jakarta.validation.constraints.*;
import java.util.Set;

public final class AuthDtos {
    private AuthDtos() { }
    public record RegisterRequest(@NotBlank @Email @Size(max=320) String email,
                                  @NotBlank @Size(min=8, max=72) String password,
                                  @NotBlank @Size(max=120) String displayName) { }
    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) { }
    public record UserResponse(Long id, String email, String displayName, Set<Role> roles) { }
}
