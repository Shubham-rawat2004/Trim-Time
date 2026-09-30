package com.trimtime.identity;

import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    @Query(value = "SELECT id FROM users WHERE id = :id FOR UPDATE", nativeQuery = true)
    Optional<Long> lockId(@Param("id") Long id);
    Optional<UserAccount> findByEmail(String email);
    boolean existsByEmail(String email);
}
