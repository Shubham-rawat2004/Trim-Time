package com.trimtime.catalogue;
import com.trimtime.salon.Salon; import jakarta.persistence.*; import java.math.BigDecimal; import java.util.*;
@Entity @Table(name="salon_addons") public class AddOn {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.EAGER) @JoinColumn(name="salon_id",nullable=false) private Salon salon;
 @Column(nullable=false,length=160) private String name; @Column(length=1000) private String description; @Column(nullable=false,precision=10,scale=2) private BigDecimal price; @Column(name="duration_minutes",nullable=false) private int durationMinutes; @Column(nullable=false) private boolean active=true;
 @ManyToMany(fetch=FetchType.EAGER) @JoinTable(name="service_addons",joinColumns=@JoinColumn(name="addon_id"),inverseJoinColumns=@JoinColumn(name="service_id")) private Set<ServiceOffering> compatibleServices=new HashSet<>();
 protected AddOn(){} public AddOn(Salon salon,String name,String description,BigDecimal price,int durationMinutes){this.salon=salon;this.name=name;this.description=description;this.price=price;this.durationMinutes=durationMinutes;}
 public Long getId(){return id;} public Salon getSalon(){return salon;} public String getName(){return name;} public String getDescription(){return description;} public BigDecimal getPrice(){return price;} public int getDurationMinutes(){return durationMinutes;} public boolean isActive(){return active;} public Set<ServiceOffering> getCompatibleServices(){return Collections.unmodifiableSet(compatibleServices);} public void addCompatibility(ServiceOffering service){compatibleServices.add(service);} public void deactivate(){active=false;}
}
