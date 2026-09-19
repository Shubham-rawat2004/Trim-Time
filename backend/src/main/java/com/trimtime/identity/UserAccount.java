package com.trimtime.identity;

import jakarta.persistence.*;
import java.util.*;

@Entity
@Table(name = "users")
public class UserAccount {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 320)
    private String email;
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
    @Column(name = "display_name", nullable = false, length = 120)
    private String displayName;
    @Column(nullable = false)
    private boolean active = true;
    @Column(name = "authorization_version", nullable = false)
    private int authorizationVersion;
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 32)
    private Set<Role> roles = new HashSet<>();

    protected UserAccount() { }
    public UserAccount(String email, String passwordHash, String displayName) {
        this.email = email; this.passwordHash = passwordHash; this.displayName = displayName;
        this.roles.add(Role.CUSTOMER);
    }
    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getDisplayName() { return displayName; }
    public boolean isActive() { return active; }
    public Set<Role> getRoles() { return Collections.unmodifiableSet(roles); }
    public void addRole(Role role) { roles.add(role); }
}
